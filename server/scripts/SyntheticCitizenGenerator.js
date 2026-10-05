// Builds the synthetic citizens PeopleSeeder adds next to the demo accounts, so
// that "how many citizens does this alert reach" gives a realistic number.
// Deterministic: the same n always gives the same name, email, phone and home
// district, so re-seeding updates each citizen in place and never adds more.
export class SyntheticCitizenGenerator {
  // How many citizens live in each district, weighted towards the two
  // districts the demo flows run in. Totals 500.
  static #DISTRICT_WEIGHTS = [
    ['Colombo', 150],
    ['Gampaha', 120],
    ['Kalutara', 60],
    ['Kandy', 50],
    ['Galle', 40],
    ['Ratnapura', 30],
    ['Kurunegala', 30],
    ['Matara', 20],
  ];

  static #FIRST_NAMES = [
    'Amal',
    'Chamari',
    'Dinesh',
    'Fathima',
    'Gayan',
    'Harini',
    'Isuru',
    'Janaki',
    'Lasith',
    'Malini',
    'Nuwan',
    'Priyanka',
    'Rohan',
    'Sanduni',
    'Tharindu',
    'Udari',
    'Vimukthi',
    'Yasodha',
    'Zahra',
    'Kavindu',
  ];

  static #LAST_NAMES = [
    'Perera',
    'Fernando',
    'Silva',
    'Jayasinghe',
    'Bandara',
    'Wickramasinghe',
    'Dissanayake',
    'Gunawardena',
    'Herath',
    'Rajapaksha',
    'Senanayake',
    'Kumara',
    'Rathnayake',
    'Mohamed',
    'Sivakumar',
  ];

  // The names of the districts the citizens live in, for the seeder to look up.
  static districtNames() {
    return SyntheticCitizenGenerator.#DISTRICT_WEIGHTS.map(([name]) => name);
  }

  // Every citizen, numbered from 1, with its home district as a district name.
  static generate() {
    const citizens = [];
    for (const [districtName, count] of SyntheticCitizenGenerator.#DISTRICT_WEIGHTS) {
      for (let i = 0; i < count; i += 1) {
        citizens.push(SyntheticCitizenGenerator.#citizen(citizens.length + 1, districtName));
      }
    }
    return citizens;
  }

  static #citizen(n, homeDistrict) {
    const first = SyntheticCitizenGenerator.#FIRST_NAMES;
    const last = SyntheticCitizenGenerator.#LAST_NAMES;
    return {
      name: `${first[n % first.length]} ${last[Math.floor(n / first.length) % last.length]}`,
      email: `citizen.synth.${n}@example.test`,
      phone: `07${String(n).padStart(8, '0')}`,
      homeDistrict,
    };
  }
}
