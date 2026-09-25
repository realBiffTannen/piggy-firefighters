"""Integer accounting at the SDK book/event boundary."""
from copy import deepcopy


def json_symbol(name):
    result = {'name': name}
    if name == 'W':
        result['wild'] = True
    if name in ('ALARM', 'GALARM'):
        result['scatter'] = True
    return result


class GameEvents:
    def emit(self, event_type, **fields):
        self.book.add_event({'index': len(self.book.events), 'type': event_type, **fields})

    def reveal(self, reel_set, stops, game_type):
        strips = self.config.reels[reel_set]
        self.board_names = [[strip[(stop + row) % len(strip)] for row in range(3)]
                            for strip, stop in zip(strips, stops)]
        board = [[json_symbol(strip[(stop + row) % len(strip)]) for row in range(-1, 4)]
                 for strip, stop in zip(strips, stops)]
        anticipation, seen = [0] * 5, 0
        if game_type == 'basegame':
            for reel in range(5):
                # Before reel r stops: two observed alarms plus a remaining reel
                # still make a trigger possible, including an eventual miss.
                if seen >= 2:
                    anticipation[reel] = 1
                seen += sum(s in ('ALARM', 'GALARM') for s in self.board_names[reel])
        self.emit('reveal', board=board, paddingPositions=list(stops), gameType=game_type,
                  anticipation=anticipation, reelSet=reel_set)

    def clip_prizes(self, rescues):
        remaining = self.cap_x100 - self.total_x100
        credited = 0
        for rescue in rescues:
            if 'prize' in rescue:
                raw = rescue['prize']
                rescue['prize'] = min(raw, remaining)
                if rescue['prize'] != raw:
                    rescue['rawPrize'] = raw
                remaining -= rescue['prize']
                credited += rescue['prize']
        return credited

    def settle(self, result, game_type, prizes=0, defer_total=False):
        remaining = self.cap_x100 - self.total_x100 - prizes
        paid_wins = []
        raw_total = result['totalWin']
        for raw_win in result['wins']:
            win = deepcopy(raw_win)
            win['win'] = min(win['win'], remaining)
            if win['win'] != raw_win['win']:
                win['meta']['uncappedWin'] = raw_win['win']
                win['meta']['capped'] = True
            remaining -= win['win']
            win['positions'] = [{'reel': p['reel'], 'row': p['row'] + 1} for p in win['positions']]
            if win['win'] > 0:
                paid_wins.append(win)
        lines = sum(win['win'] for win in paid_wins)
        if raw_total > 0:
            self.emit('winInfo', totalWin=lines, wins=paid_wins)
        credited = lines + prizes
        self.total_x100 += credited
        if game_type == 'basegame':
            self.base_x100 += credited
        else:
            self.free_x100 += credited
        self.wincap_triggered = self.total_x100 >= self.cap_x100
        if self.wincap_triggered:
            self.emit('wincap', amount=self.cap_x100)
        if credited:
            self.emit('setWin', amount=credited,
                      winLevel=self.config.get_win_level(credited / 100, 'standard'))
        if not defer_total:
            self.emit('setTotalWin', amount=self.total_x100)
        return credited
