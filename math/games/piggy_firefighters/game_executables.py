"""Actual reel draws and event-ordered base and rescue mechanics."""
from .game_calculations import evaluate_lines, RescueState
from .game_events import GameEvents
from .game_config import (initial_spins, BASE_BLAZE_COUNTS, BUY_BLAZE_COUNTS,
                          BLAZE_MULTIPLIERS, INFERNO_PRIZES_X100, BACKDRAFT_RATE)


class GameExecutables(GameEvents):
    def choose(self, weights):
        return self.rng.choices(tuple(weights), tuple(weights.values()))[0]

    def random_stops(self, reel_set):
        return [self.rng.randrange(len(strip)) for strip in self.config.reels[reel_set]]

    def base_stops(self, reel_set, route):
        buckets = self.stop_buckets[reel_set]
        if route in ('rescue', 'inferno', 'anticipation'):
            count = 2 if route == 'anticipation' else self.choose({3: 90, 4: 9, 5: 1})
            alarm_reels = set(self.rng.sample(range(5), count))
            golden_reel = self.rng.choice(sorted(alarm_reels)) if route == 'inferno' else None
            return [self.rng.choice(buckets[r]['golden' if r == golden_reel else
                    'alarm' if r in alarm_reels else 'none']) for r in range(5)]
        for _ in range(256):
            stops = self.random_stops(reel_set)
            alarms = sum(self.stop_alarm_counts[reel_set][r][stop] for r, stop in enumerate(stops))
            if alarms < 3:
                return stops
        raise RuntimeError('Non-trigger reel draw exhausted its integrity guard')

    def ignite(self, bought=False, cap_path=False):
        eligible = [(r, row) for r, reel in enumerate(self.board_names) for row, symbol in enumerate(reel)
                    if symbol not in ('W', 'ALARM', 'GALARM')]
        count = 5 if cap_path else self.choose(BUY_BLAZE_COUNTS if bought else BASE_BLAZE_COUNTS)
        if len(eligible) < count:
            raise RuntimeError('Reel window cannot supply the contracted number of Blaze cells')
        selected = [(r, 1) for r in range(5)] if cap_path else self.rng.sample(eligible, count)
        if any(cell not in eligible for cell in selected):
            raise RuntimeError('Forced cap path attempted an ineligible Blaze cell')
        cells, blaze = [], {}
        for reel, row in selected:
            self.board_names[reel][row] = 'W'
            cell = {'reel': reel, 'row': row}
            if bought:
                cell['mult'] = 10 if cap_path else self.choose(BLAZE_MULTIPLIERS)
                blaze[reel, row] = cell['mult']
            cells.append(cell)
        self.emit('backdraft', cells=cells, count=count)
        return blaze

    def run_base(self, mode, criterion):
        reel_set = 'BRA' if mode == 'ante' else 'BR0'
        route = 'inferno' if criterion == 'cap' else criterion
        if criterion == 'tail_max':
            stops = [0] * 5
        elif criterion == 'tail':
            stops = [0] * 4 + [self.rng.randrange(len(self.config.reels[reel_set][4]))]
        elif route == 'ordinary':
            # Ordinary sampling of a base round uses actual unconditional stops.
            stops = self.random_stops(reel_set)
        else:
            stops = self.base_stops(reel_set, route)
        self.reveal(reel_set, stops, 'basegame')
        alarms = [{'reel': r, 'row': row + 1} for r, reel in enumerate(self.board_names)
                  for row, symbol in enumerate(reel) if symbol in ('ALARM', 'GALARM')]
        if len(alarms) < 3 and (criterion == 'backdraft' or
                               criterion == 'ordinary' and self.rng.random() < BACKDRAFT_RATE):
            self.ignite()
        self.settle(evaluate_lines(self.board_names, self.config.paylines), 'basegame')
        if len(alarms) >= 3 and not self.wincap_triggered:
            bonus = 'inferno' if any('GALARM' in reel for reel in self.board_names) else 'rescue'
            spins = initial_spins(len(alarms))
            self.emit('freeSpinTrigger', totalFs=spins, positions=alarms)
            self.run_rescue(bonus, 'natural', spins, cap_path=criterion == 'cap')

    def run_rescue(self, bonus, source, spins=10, cap_path=False):
        state = RescueState(bonus, spins)
        self.emit('rescueStart', bonus=bonus, source=source, spins=spins,
                  rooms=[{'reel': r, 'fire': state.fire_level} for r in range(5)], multiplier=1)
        reel_set = 'FRI' if bonus == 'inferno' else 'FR0'
        start = self.total_x100
        while state.spins and not self.wincap_triggered:
            if state.played >= self.config.round_guard:
                raise RuntimeError('Bonus exceeded integrity guard; no truncated book is accepted')
            stops = list(self.cap_bonus_stops[reel_set]) if cap_path else self.random_stops(reel_set)
            self.reveal(reel_set, stops, 'freegame')
            previous_buildings = state.buildings
            douse = state.advance(self.board_names, lambda: self.choose(INFERNO_PRIZES_X100))
            prizes = self.clip_prizes(douse['rescues'])
            self.emit('douse', **douse)
            if state.buildings != previous_buildings:
                self.emit('buildingCleared', building=state.buildings, spinsAdded=5, spinsLeft=state.spins)
            result = evaluate_lines(self.board_names, self.config.paylines, state.multiplier)
            self.settle(result, 'freegame', prizes, defer_total=True)
            self.emit('updateFreeSpin', amount=state.played, total=state.played + state.spins)
            self.emit('setTotalWin', amount=self.total_x100)
        amount = self.total_x100 - start
        self.emit('rescueEnd', amount=amount, multiplier=state.multiplier,
                  rescued=state.rescued, buildings=state.buildings)
        self.emit('freeSpinEnd', amount=amount, winLevel=self.config.get_win_level(amount / 100, 'endFeature'))

    def run_backdraft_spins(self, cap_path=False):
        self.emit('backdraftSpinsStart', spins=5)
        for spin in range(1, 6):
            stops = list(self.cap_backdraft_stops) if cap_path else self.random_stops('BRB')
            self.reveal('BRB', stops, 'freegame')
            blaze = self.ignite(bought=True, cap_path=cap_path)
            result = evaluate_lines(self.board_names, self.config.paylines, blaze=blaze)
            self.settle(result, 'freegame', defer_total=True)
            self.emit('updateFreeSpin', amount=spin, total=5)
            self.emit('setTotalWin', amount=self.total_x100)
            if self.wincap_triggered:
                break
        self.emit('backdraftSpinsEnd', amount=self.total_x100)

    def run_alarm_call(self, criterion):
        route = 'rescue' if criterion == 'cap_rescue' else 'inferno' if criterion in ('cap', 'cap_inferno') else criterion
        if route == 'ordinary':
            p = (self.config.mode_costs['alarm_call'] - .03 * self.config.mode_costs['inferno']) / self.config.mode_costs['rescue']
            route = self.choose({'rescue': p, 'inferno': .03, 'falseAlarm': 1 - p - .03})
        if route not in ('rescue', 'inferno', 'falseAlarm'):
            raise ValueError(f'Unknown Alarm Call route {route}')
        self.emit('alarmCall', outcome=route)
        if route == 'falseAlarm':
            self.emit('setTotalWin', amount=0)
        else:
            self.run_rescue(route, 'alarmCall', cap_path=criterion.startswith('cap'))
