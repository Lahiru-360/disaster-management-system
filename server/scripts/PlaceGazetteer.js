// The towns and villages the place search knows (UC02 A2, contract §9.8): a
// few well-known places in each of the 25 districts, more around the demo
// districts. [name, district, latitude, longitude], decimal degrees. Mocked
// geocoding, as the FAQ allows; coordinates are approximate town centres.
export const PLACE_GAZETTEER = Object.freeze([
  // Western
  ['Colombo Fort', 'Colombo', 6.9344, 79.8428],
  ['Kolonnawa', 'Colombo', 6.9329, 79.8848],
  ['Kotikawatta', 'Colombo', 6.9282, 79.9122],
  ['Dehiwala', 'Colombo', 6.8517, 79.8653],
  ['Maharagama', 'Colombo', 6.8484, 79.9265],
  ['Kaduwela', 'Colombo', 6.9333, 79.9833],
  ['Avissawella', 'Colombo', 6.9533, 80.21],
  ['Homagama', 'Colombo', 6.844, 80.0024],
  ['Gampaha', 'Gampaha', 7.0917, 79.9999],
  ['Negombo', 'Gampaha', 7.2083, 79.8358],
  ['Ja-Ela', 'Gampaha', 7.0744, 79.8919],
  ['Kelaniya', 'Gampaha', 6.9553, 79.922],
  ['Biyagama', 'Gampaha', 6.9425, 79.9878],
  ['Minuwangoda', 'Gampaha', 7.1667, 79.95],
  ['Kalutara', 'Kalutara', 6.5854, 79.9607],
  ['Panadura', 'Kalutara', 6.7132, 79.9026],
  ['Horana', 'Kalutara', 6.7159, 80.0626],
  ['Beruwala', 'Kalutara', 6.4789, 79.9828],
  // Central
  ['Kandy', 'Kandy', 7.2906, 80.6337],
  ['Peradeniya', 'Kandy', 7.2692, 80.5942],
  ['Gampola', 'Kandy', 7.1643, 80.5696],
  ['Matale', 'Matale', 7.4675, 80.6234],
  ['Dambulla', 'Matale', 7.8742, 80.6511],
  ['Nuwara Eliya', 'Nuwara Eliya', 6.9497, 80.7891],
  ['Hatton', 'Nuwara Eliya', 6.8916, 80.5955],
  // Southern
  ['Galle', 'Galle', 6.0535, 80.221],
  ['Hikkaduwa', 'Galle', 6.1395, 80.1063],
  ['Ambalangoda', 'Galle', 6.2355, 80.0538],
  ['Matara', 'Matara', 5.9549, 80.555],
  ['Akuressa', 'Matara', 6.096, 80.4782],
  ['Hambantota', 'Hambantota', 6.1241, 81.1185],
  ['Tangalle', 'Hambantota', 6.0243, 80.7941],
  // Northern
  ['Jaffna', 'Jaffna', 9.6615, 80.0255],
  ['Point Pedro', 'Jaffna', 9.8167, 80.2333],
  ['Kilinochchi', 'Kilinochchi', 9.3803, 80.377],
  ['Mannar', 'Mannar', 8.981, 79.9044],
  ['Vavuniya', 'Vavuniya', 8.7514, 80.4971],
  ['Mullaitivu', 'Mullaitivu', 9.2671, 80.8142],
  // Eastern
  ['Batticaloa', 'Batticaloa', 7.731, 81.6747],
  ['Kattankudy', 'Batticaloa', 7.675, 81.73],
  ['Ampara', 'Ampara', 7.2912, 81.6724],
  ['Kalmunai', 'Ampara', 7.4167, 81.8167],
  ['Trincomalee', 'Trincomalee', 8.5874, 81.2152],
  ['Kinniya', 'Trincomalee', 8.495, 81.183],
  // North Western
  ['Kurunegala', 'Kurunegala', 7.4863, 80.3623],
  ['Kuliyapitiya', 'Kurunegala', 7.4688, 80.0401],
  ['Puttalam', 'Puttalam', 8.0362, 79.8283],
  ['Chilaw', 'Puttalam', 7.5758, 79.7953],
  // North Central
  ['Anuradhapura', 'Anuradhapura', 8.3114, 80.4037],
  ['Kekirawa', 'Anuradhapura', 8.0373, 80.5981],
  ['Polonnaruwa', 'Polonnaruwa', 7.9403, 81.0188],
  ['Hingurakgoda', 'Polonnaruwa', 8.0417, 80.95],
  // Uva
  ['Badulla', 'Badulla', 6.9934, 81.055],
  ['Bandarawela', 'Badulla', 6.8259, 80.9982],
  ['Monaragala', 'Monaragala', 6.8728, 81.3507],
  ['Wellawaya', 'Monaragala', 6.7372, 81.1028],
  // Sabaragamuwa
  ['Ratnapura', 'Ratnapura', 6.6828, 80.3992],
  ['Embilipitiya', 'Ratnapura', 6.3439, 80.8492],
  ['Kegalle', 'Kegalle', 7.2513, 80.3464],
  ['Mawanella', 'Kegalle', 7.2528, 80.4467],
]);
