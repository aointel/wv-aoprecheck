import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

home = s.get('https://pod.planetaltig.com/')

# Get full typeahead initialization
idx = home.text.find('LoadTypeHead')
print(home.text[idx:idx+2000])
