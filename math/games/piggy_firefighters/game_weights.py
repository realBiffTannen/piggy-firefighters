"""Bounded deterministic maximum-entropy weighting; no Rust optimizer."""
import math
import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp
from .game_config import (RTP_TARGET, BASE_RESCUE_RATE, BASE_INFERNO_RATE, BACKDRAFT_RATE)


class FitError(RuntimeError):
    pass


def fit_probabilities(features, targets, prior=None):
    """Find the least-change positive distribution closing supplied moments.

    BFGS is bounded to 250 iterations. An unresolved constraint is an explicit
    failure; callers must not label such a result solved or publishable.
    """
    matrix = np.asarray(features, dtype=float)
    target = np.asarray(targets, dtype=float)
    if matrix.ndim != 2 or len(matrix) < 1 or matrix.shape[1] != len(target):
        raise FitError('Invalid moment matrix')
    if np.any(target < matrix.min(axis=0) - 1e-12) or np.any(target > matrix.max(axis=0) + 1e-12):
        raise FitError('Requested moment is outside sampled support')
    prior = np.ones(len(matrix)) / len(matrix) if prior is None else np.asarray(prior, dtype=float)
    if np.any(prior <= 0):
        raise FitError('Every source outcome needs a positive prior')
    prior /= prior.sum()
    scale = np.maximum.reduce([matrix.std(axis=0), np.abs(target), np.full(len(target), .001)])
    centered = (matrix - target) / scale
    log_prior = np.log(prior)

    def value_gradient(theta):
        logits = log_prior + np.sum(centered * theta, axis=1)
        partition = logsumexp(logits)
        probabilities = np.exp(logits - partition)
        return partition, np.sum(probabilities[:, None] * centered, axis=0)

    fit = minimize(value_gradient, np.zeros(len(target)), method='BFGS', jac=True,
                   options={'gtol': 2e-11, 'maxiter': 250})
    logits = log_prior + np.sum(centered * fit.x, axis=1)
    probabilities = np.exp(logits - logsumexp(logits))
    error = np.sum(probabilities[:, None] * matrix, axis=0) - target
    relative = np.max(np.abs(error) / np.maximum(np.abs(target), .001))
    if not np.isfinite(relative) or relative > 2e-7:
        raise FitError(f'Moment solve did not close: relative={relative:.3g}, errors={error.tolist()}')
    return probabilities, {'iterations': int(fit.nit), 'max_relative_error': float(relative)}


def integer_weights(probabilities, budget=10**18):
    """Largest-remainder rounding with one unit reserved for every book."""
    probabilities = np.asarray(probabilities, dtype=float)
    if len(probabilities) >= budget or np.any(probabilities < 0) or not np.isfinite(probabilities).all():
        raise FitError('Invalid probability vector')
    probabilities /= probabilities.sum()
    exact = probabilities * (budget - len(probabilities))
    weights = np.floor(exact).astype(np.int64) + 1
    remainder = int(budget - sum(int(w) for w in weights))
    order = np.argsort(-(exact - np.floor(exact)), kind='stable')
    if remainder >= 0:
        whole, extra = divmod(remainder, len(weights))
        weights += whole
        weights[order[:extra]] += 1
    else:
        # Float multiplication at the1e18 budget may overshoot by several ulps,
        # exceeding the number of rows in a tiny test. Remove that residue from
        # the largest weight without threatening one-unit rare outcomes.
        largest = int(np.argmax(weights))
        if int(weights[largest]) + remainder < 1:
            raise FitError('Integerization residue exceeds the available weight')
        weights[largest] += remainder
    if sum(int(w) for w in weights) != budget:
        raise FitError('Integer weight budget failed to close')
    return weights


def _mean_fit(payouts, target, cap_probability):
    payouts = np.asarray(payouts, dtype=float)
    cap = payouts == 15000
    ordinary = ~cap
    if not cap.any() or not ordinary.any():
        raise FitError('Need real cap and non-cap books')
    p = np.zeros(len(payouts))
    p[cap] = cap_probability / cap.sum()
    mean = (target - cap_probability * 15000) / (1 - cap_probability)
    # Aggregate equal payouts: solve dimension depends on payout support, not book count.
    values, inverse, counts = np.unique(payouts[ordinary], return_inverse=True, return_counts=True)
    fitted, details = fit_probabilities(values[:, None], [mean], prior=counts.astype(float))
    p[ordinary] = (1 - cap_probability) * fitted[inverse] / counts[inverse]
    return p, details


def summarize(records, weights, cost):
    # CPython3.14 + NumPy2.2.5 can elide a live single-reference array in
    # chained large-array expressions. Scalar reductions avoid that dependency
    # in the publication audit and keep category probabilities exact integers.
    total = sum(int(w) for w in weights)
    if total <= 0 or len(records) != len(weights) or min(weights) < 1:
        raise FitError('Invalid publication weights')
    mean = math.fsum(int(w) / total * (r[0] / 100 / cost) for r, w in zip(records, weights))
    second = math.fsum(int(w) / total * (r[0] / 100 / cost)**2 for r, w in zip(records, weights))
    counts = dict.fromkeys(('any_win', 'regular_hit', 'sub_hit', 'rescue_probability',
                           'inferno_probability', 'backdraft_probability', 'cap_probability'), 0)
    for (payout, route, backdraft), weight in zip(records, weights):
        weight = int(weight)
        if payout > 0:
            counts['any_win'] += weight
        if payout >= cost * 100:
            counts['regular_hit'] += weight
        elif payout > 0:
            counts['sub_hit'] += weight
        if route in ('rescue', 'inferno'):
            counts[route + '_probability'] += weight
        if backdraft:
            counts['backdraft_probability'] += weight
        if payout == 1500000:
            counts['cap_probability'] += weight
    return {'cost': cost, 'rtp': mean, 'sd_over_cost': math.sqrt(max(0, second - mean**2)),
            'total_weight': total, 'minimum_weight': int(min(weights)),
            **{key: value / total for key, value in counts.items()}}


def solve_bank(records, target, cap_probability, budget):
    payouts = np.array([r[0] / 100 for r in records])
    p, details = _mean_fit(payouts, target, cap_probability)
    weights = integer_weights(p, budget)
    cap_indices = np.flatnonzero(payouts == 15000)
    # Pin total cap mass after integerization, preserving positive rare rows.
    target_cap = round(budget * cap_probability)
    difference = target_cap - sum(int(weights[i]) for i in cap_indices)
    if target_cap < len(cap_indices):
        raise FitError('Bank budget cannot represent positive cap rows at target probability')
    weights[cap_indices[0]] += difference
    weights[int(np.argmax(np.where(payouts < 15000, weights, 0)))] -= difference
    if min(weights) < 1 or sum(int(w) for w in weights) != budget:
        raise FitError('Cap rounding violated the bank budget')
    return weights, details


def solve_mode(mode, records, config):
    if mode not in ('rescue', 'inferno', 'backdraft_spins'):
        raise FitError('Natural and Alarm Call modes must compose immutable shared bonus banks')
    from .game_banks import BANK_BUDGET
    frequency = {'rescue': 1e-6, 'inferno': 4e-6, 'backdraft_spins': 4e-6}[mode]
    weights, details = solve_bank(records, RTP_TARGET * config.mode_costs[mode], frequency, BANK_BUDGET)
    report = summarize(records, weights, config.mode_costs[mode])
    report['fit'] = details
    return weights, report


def solve_nonbonus(mode, records, banks, config):
    """Fit ONLY non-bonus rows to residual moments; canonical weights are read-only.

    Each bank exposes records and integer weights with BANK_BUDGET total. Its
    integer natural factor determines immutable unconditional contribution.
    """
    from .game_banks import BANK_BUDGET, NATURAL_DENOMINATOR, natural_factors
    if mode not in ('base', 'ante') or any(r[1] != 'none' for r in records):
        raise FitError('Non-bonus fitting received a bonus row')
    cost = config.mode_costs[mode]
    factors = natural_factors(mode)
    total = BANK_BUDGET * NATURAL_DENOMINATOR
    nonbonus_budget = total - sum(factors.values()) * BANK_BUDGET
    sd = 14.4 if mode == 'base' else 9.5
    targets = [RTP_TARGET, sd * sd + RTP_TARGET**2, BACKDRAFT_RATE]
    if mode == 'base':
        targets += [.22, .16]
    else:
        targets += [.75]

    def features(rows):
        payouts = np.array([r[0] / 100 for r in rows])
        x = payouts / cost
        columns = [x, x*x, np.array([r[2] for r in rows], dtype=float)]
        if mode == 'base':
            columns += [((x > 0) & (x < 1)).astype(float), (x >= 1).astype(float)]
        else:
            columns += [payouts * (x >= 40)]
        return np.column_stack(columns)

    fixed = np.zeros(len(targets))
    for key, factor in factors.items():
        bank = banks[key]
        probability = np.asarray(bank['weights'], dtype=float) * factor / total
        fixed += np.sum(probability[:, None] * features(bank['records']), axis=0)
    adjusted = (np.array(targets) - fixed) / (nonbonus_budget / total)
    matrix = features(records)
    unique, inverse, counts = np.unique(matrix, axis=0, return_inverse=True, return_counts=True)
    fitted, details = fit_probabilities(unique, adjusted, prior=counts.astype(float))
    weights = integer_weights(fitted[inverse] / counts[inverse], nonbonus_budget)
    details.update(fixed_bank_moments=fixed.tolist(), residual_nonbonus_targets=adjusted.tolist(),
                   nonbonus_weight_budget=nonbonus_budget)
    return weights, details
