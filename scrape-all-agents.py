import urllib.request
import urllib.parse
import http.cookiejar
import sys
import json
import re
import time

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

def get_agent_data(name):
    # Generate alias variants
    clean = re.sub(r'[^a-zA-Z\s]', '', name).lower()
    parts = clean.split()
    
    aliases = [
        ''.join(parts),  # firstmiddlelast
        parts[0] + parts[-1],  # firstlast
        ''.join(parts[:2]) + parts[-1] if len(parts) > 2 else None,  # firstmidlast
    ]
    
    for alias in aliases:
        if not alias:
            continue
        try:
            url = f'https://pod.planetaltig.com/AssociateDetails?u={alias}'
            resp = opener.open(url)
            content = resp.read().decode('utf-8', errors='replace')
            
            # Extract fields
            rows = re.findall(r'<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>', content, re.DOTALL)
            data = {}
            for th, td in rows:
                th_c = re.sub(r'<[^>]+>', '', th).strip()
                td_c = re.sub(r'<[^>]+>', '', td).strip()
                if th_c:
                    data[th_c] = td_c
            
            if data.get('Name') and data['Name'].lower() != 'mandella, michael':
                return data, alias
        except:
            pass
        time.sleep(0.1)
    
    return None, None

# The 93 agents from the CSV
names = [
    "Aaron G Lawrence","Aaron Lowell Stander","Adaisha Darby","Alexandra Dominguez",
    "Amari J Kerr","Amy Jewell Beauchamp","Amy Jo Knight Commander","Andrew Walker",
    "Anthony Greco","Ashley Nicole Gamache","Aubrey Wolfe","Austin Wayne Smith",
    "Boris Koprivica","Brandon Quinn Cabeceiras","Bruce L Moxley","Camila Dalbem Andrade",
    "Carolina Jorge F Richmond","Cathleen Hairston","Christian Samuel Mercado",
    "Christina-Maria Mapuana Anna Altvater","Colby Devon Richards","Craig Stasiowski",
    "Cynthia Schomp","Dawid Liniewski","Dontaeja Smart","Drew Thomas Sharp",
    "Eleanor Rose Giles","Eric Geiss","Felipe R Machado Santanna","Fidel R Escobar",
    "Gabriel Arsene De Souza","George Carl Tockstein","Helen Bradley","Hortensia Angel Joseph",
    "Jakeline Ferreira Campos Olive","Janice Nicole Badger","Jiael Zenia Astwood",
    "Jonathan Angel Cantu","Jonathan Carrero","Junia Williams","Justin Zeramby",
    "Kaitlyn Lorraine Tuckmantel","Kendall Rena Grewer","Kimberly D Alston",
    "Kristian Portante","Krystal K Redding","Kyra Hopkins","Kywan Gilbert Jasper Sheppard",
    "Lalitha Janardhanan","Linda Scott","Lisa Yvette Smithson","Lleison Martinez",
    "Lynell Dominic Collier","Madison Smith","Matheus Bob","Michael N Locke",
    "Michael Ryan Shepler","Mistie Clontz Cockman","Monica Leticia Pina De Barros",
    "Natalia Lopes Monteiro","Nicholas Paul Triantafyllidis","Nicholas Walker",
    "Nicole Renee Paul","Nicolette Van Rensburg","Nikolaus Walter","Nivea Shanice Bryan",
    "Nolangie Rosado Pabon","Pallavi Varshney","Pamela Sue Faircloth","Paul Michael Demeo",
    "Philip Prata","Renata Johnson","Robert Gilman","Robert Lee Jones",
    "Rodney Jones","Ryan Wilson","Samantha P Nowak","Samuel Donadio",
    "Sean Gregory Melaven","Sean Hansen","Sergio D Vincenti","Sophia Limonciello",
    "Terrelle L Goslee-Adams","Teshaun Devoise","Theresa Jo Bryson","Timothy Matthew Wilson",
    "Towanya Thompson","Treyson Scott","Tyran Carter","Vitor Ingles Buche",
    "William Frederick Lawson","Yaury Victoria","Zaki Blanding"
]

results = []
not_found = []

for i, name in enumerate(names):
    data, alias = get_agent_data(name)
    if data:
        associate_id = data.get('Associate ID', '')
        company_email = data.get('Company Email', f'{alias}@aoglobelife.com')
        results.append({
            'name': name,
            'alias': alias,
            'associate_id': associate_id,
            'company_email': company_email,
            'planet_name': data.get('Name', ''),
        })
        print(f'✅ {name} -> {associate_id} / {company_email}')
    else:
        not_found.append(name)
        print(f'❌ {name}')
    
    if (i+1) % 10 == 0:
        time.sleep(1)

print(f'\n\nFound: {len(results)}/{len(names)}')
print('Not found:', not_found)

with open(r'C:\dev\AOIrail\planet-agents.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)
print('Saved to planet-agents.json')
