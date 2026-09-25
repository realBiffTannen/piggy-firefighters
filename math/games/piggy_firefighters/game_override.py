"""Game-local initialization; shared SDK files are never modified."""
from src.state.state import GeneralGameState
from .game_executables import GameExecutables


class GameStateOverride(GameExecutables, GeneralGameState):
    def assign_special_sym_function(self):
        self.special_symbol_functions = {}

    def initialize_strip_indices(self):
        self.stop_buckets, self.stop_alarm_counts = {}, {}
        for name in ('BR0', 'BRA'):
            self.stop_buckets[name], self.stop_alarm_counts[name] = [], []
            for strip in self.config.reels[name]:
                buckets = {'none': [], 'alarm': [], 'golden': []}
                counts = []
                for stop in range(len(strip)):
                    window = [strip[(stop + i) % len(strip)] for i in range(3)]
                    count = sum(s in ('ALARM', 'GALARM') for s in window)
                    counts.append(count)
                    if count == 0:
                        buckets['none'].append(stop)
                    elif count == 1:
                        buckets['golden' if 'GALARM' in window else 'alarm'].append(stop)
                self.stop_buckets[name].append(buckets)
                self.stop_alarm_counts[name].append(counts)

        def find_windows(reel_set, window):
            stops = []
            for strip in self.config.reels[reel_set]:
                matches = [i for i in range(len(strip))
                           if [strip[(i + j) % len(strip)] for j in range(3)] == window]
                if not matches:
                    raise RuntimeError(f'{reel_set} has no real source window {window}')
                stops.append(matches[0])
            return stops
        self.cap_backdraft_stops = find_windows('BRB', ['H1'] * 3)
        self.cap_bonus_stops = {name: find_windows(name, ['W', 'W', 'H1']) for name in ('FR0', 'FRI')}
