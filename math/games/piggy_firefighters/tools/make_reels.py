"""Reproduce original deterministic reel CSVs; never runs on model import."""
import csv
import random
from pathlib import Path

LENGTH = 512
PAYING = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4']
WEIGHTS = [10, 20, 30, 38, 60, 72, 74, 76]


def build_reels():
    output = Path(__file__).resolve().parents[1] / 'reels'
    output.mkdir(exist_ok=True)
    for set_index, name in enumerate(('BR0', 'BRA', 'BRB', 'FR0', 'FRI')):
        columns = []
        for reel in range(5):
            rng = random.Random(20260925 + 1000 * set_index + reel)
            strip = rng.choices(PAYING, WEIGHTS, k=LENGTH)
            # Every max path uses these real positive-probability strip windows.
            strip[0:3] = ['H1', 'H1', 'H1']
            if name in ('FR0', 'FRI'):
                strip[8:11] = ['W', 'W', 'H1']
            wild_count = {'BR0': 5, 'BRA': 5, 'BRB': 5, 'FR0': 24, 'FRI': 14}[name]
            if reel > 0 or name in ('FR0', 'FRI'):
                for index in rng.sample(range(16, LENGTH - 3), wild_count):
                    strip[index] = 'W'
            if name in ('BR0', 'BRA'):
                alarm_count = 12 if name == 'BR0' else 18
                slots = list(range(24, LENGTH - 3))
                rng.shuffle(slots)
                chosen = []
                for index in slots:
                    if strip[index] != 'W' and all(abs(index - prev) >= 3 for prev in chosen):
                        chosen.append(index)
                    if len(chosen) == alarm_count:
                        break
                for number, index in enumerate(chosen):
                    strip[index] = 'GALARM' if number == 0 else 'ALARM'
            columns.append(strip)
        with (output / f'{name}.csv').open('w', newline='') as stream:
            csv.writer(stream, lineterminator='\n').writerows(zip(*columns))


if __name__ == '__main__':
    build_reels()
