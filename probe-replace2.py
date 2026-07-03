import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

home = s.get('https://pod.planetaltig.com/')

# Find the replace function in LoadTypeHead
idx = home.text.find('function LoadTypeHead')
print('=== LoadTypeHead full ===')
print(home.text[idx:idx+1500])
