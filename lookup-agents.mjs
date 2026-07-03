import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'
);

// Names from the CSV
const names = [
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
];

// Check producerlist by agent_name
const { data: producers } = await sb.from('producerlist')
  .select('associate_id, agent_name, company_email')
  .not('agent_name', 'is', null);

console.log(`Total in producerlist: ${producers?.length}`);

const found = [];
const notFound = [];

for (const name of names) {
  const lastName = name.split(' ').pop().toUpperCase();
  const firstName = name.split(' ')[0].toUpperCase();
  
  const match = producers?.find(p => {
    const pname = (p.agent_name || '').toUpperCase();
    return pname.includes(lastName) && pname.includes(firstName);
  });
  
  if (match) {
    found.push({ name, associate_id: match.associate_id, email: match.company_email, db_name: match.agent_name });
  } else {
    notFound.push(name);
  }
}

console.log(`\n✅ Found ${found.length}/${names.length} in producerlist:`);
found.forEach(f => console.log(`  ${f.name} → ${f.associate_id} (${f.email})`));

console.log(`\n❌ Not found (${notFound.length}):`);
notFound.forEach(n => console.log(`  ${n}`));
