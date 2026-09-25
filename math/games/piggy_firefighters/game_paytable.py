"""Awards are integer hundredths of total base bet per line."""

PAYTABLE_X100 = {
    'H1': {3: 150, 4: 500, 5: 2500},
    'H2': {3: 100, 4: 300, 5: 1200},
    'H3': {3: 60, 4: 200, 5: 800},
    'H4': {3: 50, 4: 150, 5: 500},
    'L1': {3: 30, 4: 80, 5: 250},
    'L2': {3: 20, 4: 60, 5: 200},
    'L3': {3: 20, 4: 50, 5: 150},
    'L4': {3: 10, 4: 40, 5: 120},
    'W': {3: 150, 4: 500, 5: 2500},
}
PAYTABLE = {(count, symbol): award / 100 for symbol, values in PAYTABLE_X100.items()
            for count, award in values.items()}
SPECIAL_SYMBOLS = {'wild': ['W'], 'scatter': ['ALARM', 'GALARM']}
