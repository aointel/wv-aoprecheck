import urllib.request
import urllib.parse
import http.cookiejar
import re
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', 'Mozilla/5.0')]

login_data = urllib.parse.urlencode({'Alias': 'michaelmandella', 'Password': 'C8fkef8agyeh!!'}).encode()
opener.open('https://pod.planetaltig.com/Account/Login', login_data)

# Get my associate ID as baseline (231)
MY_ASSOC_ID = '231'
MY_EMAIL = 'michaelmandella@aoglobelife.com'

def get_agent(alias):
    try:
        resp = opener.open(f'https://pod.planetaltig.com/AssociateDetails?u={alias}', timeout=10)
        html = resp.read().decode('utf-8', errors='replace')
        
        # Get associate ID from hidden input
        assoc_m = re.search(r'id="associate_Id"\s+value="([^"]+)"', html)
        assoc_id = assoc_m.group(1) if assoc_m else None
        
        # Get email
        emails = re.findall(r'[a-zA-Z0-9._%+\-]+@aoglobelife\.com', html)
        email = emails[0] if emails else None
        
        # Get name from H1/H2
        name_m = re.search(r'<h[12][^>]*>\s*([^<]{5,60})\s*</h[12]>', html)
        page_name = name_m.group(1).strip() if name_m else None
        
        # If returns MY data, it's a miss
        if assoc_id == MY_ASSOC_ID or email == MY_EMAIL:
            return None
        
        return {'alias': alias, 'associate_id': assoc_id, 'company_email': email, 'page_name': page_name}
    except Exception as e:
        return None

NAMES = [
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

def name_to_aliases(name):
    """Generate possible planet aliases for a name."""
    parts = [p.lower() for p in name.split() if re.match(r'[a-z]', p.lower())]
    # Filter out middle initials (single letters)
    parts_no_middle = [p for p in parts if len(p) > 1]
    
    aliases = []
    if len(parts_no_middle) >= 2:
        # firstname + lastname
        aliases.append(parts_no_middle[0] + parts_no_middle[-1])
        # firstname + last two words
        if len(parts_no_middle) >= 3:
            aliases.append(parts_no_middle[0] + parts_no_middle[-2] + parts_no_middle[-1])
    
    return aliases

found = {}
not_found = []

for name in NAMES:
    aliases = name_to_aliases(name)
    hit = None
    for alias in aliases:
        result = get_agent(alias)
        if result:
            hit = result
            break
    
    if hit:
        print(f'✅ {name} -> alias={hit["alias"]} assoc={hit["associate_id"]} email={hit["company_email"]} page={hit["page_name"]}')
        found[name] = hit
    else:
        not_found.append(name)
        print(f'❌ {name} (tried: {", ".join(aliases)})')

print(f'\n=== {len(found)} found, {len(not_found)} not found ===')

with open('alias-results.json', 'w') as f:
    json.dump({'found': found, 'not_found': not_found}, f, indent=2)
