import requests, re, sys
sys.stdout.reconfigure(encoding='utf-8')

s = requests.Session()
s.headers.update({'User-Agent': 'Mozilla/5.0'})
s.post('https://pod.planetaltig.com/Account/Login', data={'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'})

# Fetch the bootstrap-typeahead script
r = s.get('https://pod.planetaltig.com/bootstrap-typeahead/scripts?v=INI7Zgf0JzhRny18z336_TlUg2wpb2xnq-8oNEXeY481')
print('typeahead script len:', len(r.text))

# Search for ajax/header/beforeSend patterns
for term in ['beforeSend', 'headers', 'token', 'RequestVerif', 'ajaxSetup', 'source:', 'ajax(']:
    idx = r.text.find(term)
    if idx >= 0:
        print(f'\n=== {term} at {idx} ===')
        print(r.text[max(0,idx-50):idx+300])

# Also look for how it sends the term parameter
for term in ['term', 'query', 'q=', 'source']:
    idx = r.text.find(term)
    if idx >= 0:
        print(f'\n=== {term} at {idx} ===')
        print(r.text[max(0,idx-30):idx+200])
        break
