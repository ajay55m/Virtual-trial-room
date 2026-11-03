/**
 * VirtualFit AI Studio - Universal Dataset
 * Supports ANY garment type: Jackets, Shirts, T-shirts, Pants, Kurtas, Dresses, Gowns, Sarees.
 */

const DEMO_MODELS = [
  { 
    id: 1, 
    name: "Aisha", 
    gender: "female",
    height: 168,
    img: "assets/models/model-1.jpg",
    desc: "Female Model • 168 cm • Athletic Frame"
  },
  { 
    id: 2, 
    name: "Priya", 
    gender: "female",
    height: 165,
    img: "assets/models/model-2.jpg",
    desc: "Female Model • 165 cm • Petite Frame"
  },
  { 
    id: 3, 
    name: "Aryan", 
    gender: "male",
    height: 178,
    img: "assets/models/model-3.jpg",
    desc: "Male Model • 178 cm • Medium Build"
  },
  { 
    id: 4, 
    name: "Vikram", 
    gender: "male",
    height: 182,
    img: "assets/models/model-4.jpg",
    desc: "Male Model • 182 cm • Athletic Build"
  }
];

const UNIVERSAL_GARMENTS = [
  {
    id: "garment-01",
    name: "Men's Midnight Black Leather Biker Jacket",
    type: "jacket",
    category: "upper_body",
    gender: "male",
    price: "INR 4,999",
    priceNumber: 4999,
    img: "assets/clothes/jacket-01-black.jpg",
    color: "#18181b",
    pattern: "solid leather",
    wearing_instructions: "Wear over torso and chest as stylish outerwear with collar and lapels spread",
    garment_desc: "a premium men's midnight black leather biker jacket with metallic zips, worn over torso",
    badge: "Outerwear"
  },
  {
    id: "garment-02",
    name: "Men's Navy Slim-Fit Tailored Blazer",
    type: "jacket",
    category: "upper_body",
    gender: "male",
    price: "INR 3,999",
    priceNumber: 3999,
    img: "assets/clothes/blazer-01-navy.jpg",
    color: "#1e3a8a",
    pattern: "fine weave",
    wearing_instructions: "Wear structured over shoulders and chest with notch lapels",
    garment_desc: "a sharp men's navy blue tailored formal blazer with notched lapel and button closure",
    badge: "Formal"
  },
  {
    id: "garment-03",
    name: "Classic Organic Cotton White Crewneck T-Shirt",
    type: "tshirt",
    category: "upper_body",
    gender: "unisex",
    price: "INR 899",
    priceNumber: 899,
    img: "assets/clothes/tshirt-01-white.jpg",
    color: "#f8fafc",
    pattern: "plain solid",
    wearing_instructions: "Pull over head and fit comfortably around chest and shoulders",
    garment_desc: "a clean classic crewneck white organic cotton t-shirt fitted comfortably on torso",
    badge: "Casual"
  },
  {
    id: "garment-04",
    name: "Men's Oxford Formal Sky Blue Shirt",
    type: "shirt",
    category: "upper_body",
    gender: "male",
    price: "INR 1,799",
    priceNumber: 1799,
    img: "assets/clothes/shirt-01-blue.jpg",
    color: "#38bdf8",
    pattern: "oxford weave",
    wearing_instructions: "Button down center with collar crisp and cuffs fitted",
    garment_desc: "a formal men's sky blue oxford button-down shirt with structured collar",
    badge: "Office"
  },
  {
    id: "garment-05",
    name: "Men's Royal Silk Bandhgala Jodhpuri Kurta",
    type: "kurta",
    category: "full_body",
    gender: "male",
    price: "INR 3,499",
    priceNumber: 3499,
    img: "assets/clothes/kurta-01-men.jpg",
    color: "#312e81",
    pattern: "brocade textured",
    wearing_instructions: "Wear Mandarin collar jacket over torso down to hips with matching trousers",
    garment_desc: "a royal Indian men's bandhgala jodhpuri silk jacket with gold buttons",
    badge: "Ethnic"
  },
  {
    id: "garment-06",
    name: "Men's Traditional Festive Kurta Pajama Set",
    type: "kurta",
    category: "full_body",
    gender: "male",
    price: "INR 2,299",
    priceNumber: 2299,
    img: "assets/clothes/kurta-02-men.jpg",
    color: "#ca8a04",
    pattern: "embroidered neckline",
    wearing_instructions: "Wear full-length kurta down to knees paired with straight-cut pajama",
    garment_desc: "a traditional men's festive silk kurta pajama set with embroidered placket",
    badge: "Festive"
  },
  {
    id: "garment-07",
    name: "Haute Couture Velvet Black Evening Gown",
    type: "gown",
    category: "full_body",
    gender: "female",
    price: "INR 5,499",
    priceNumber: 5499,
    img: "assets/clothes/black_dress.jpg",
    color: "#0f172a",
    pattern: "velvet sheen",
    wearing_instructions: "Floor-length evening silhouette fitted from bodice down to trailing hemline",
    garment_desc: "a luxurious women's floor-length black evening dress with elegant fitted silhouette",
    badge: "Luxury"
  },
  {
    id: "garment-08",
    name: "Festive Mustard Chanderi Silk Kurta Set",
    type: "kurta",
    category: "full_body",
    gender: "female",
    price: "INR 2,499",
    priceNumber: 2499,
    img: "assets/clothes/yellow_kurta_set.jpg",
    color: "#eab308",
    pattern: "zari embroidery",
    wearing_instructions: "Straight-cut kurta with dupatta draped across shoulders and matching pants",
    garment_desc: "a women's mustard yellow embroidered chanderi kurta set with silk dupatta",
    badge: "Festive"
  },
  {
    id: "garment-09",
    name: "Royal Sapphire Blue Banarasi Silk Saree",
    type: "saree",
    category: "full_body",
    gender: "female",
    price: "INR 2,499",
    priceNumber: 2499,
    img: "assets/clothes/saree-01-blue-banarasi.jpg",
    color: "#1e3a8a",
    pattern: "silver brocade",
    wearing_instructions: "Pleats tucked neatly at front waist with pallu draped gracefully over left shoulder",
    garment_desc: "a royal sapphire blue banarasi silk saree with silver brocade work and silver border",
    badge: "Saree"
  },
  {
    id: "garment-10",
    name: "Crimson Red Banarasi Wedding Silk Saree",
    type: "saree",
    category: "full_body",
    gender: "female",
    price: "INR 2,799",
    priceNumber: 2799,
    img: "assets/clothes/saree-02-red-banarasi.jpg",
    color: "#991b1b",
    pattern: "gold zari border",
    wearing_instructions: "Traditional wedding drape with pleated pallu pinned at left shoulder",
    garment_desc: "a crimson red banarasi silk saree with golden zari border and rich pallu",
    badge: "Bridal"
  },
  {
    id: "garment-11",
    name: "Emerald Green Kanjivaram Temple Silk Saree",
    type: "saree",
    category: "full_body",
    gender: "female",
    price: "INR 3,299",
    priceNumber: 3299,
    img: "assets/clothes/saree-03-green-kanjivaram.jpg",
    color: "#065f46",
    pattern: "gold temple motifs",
    wearing_instructions: "South Indian traditional drape with wide gold temple border",
    garment_desc: "an emerald green kanjivaram silk saree with authentic golden woven border",
    badge: "Heritage"
  },
  {
    id: "garment-12",
    name: "Blush Pink Art Silk Floral Saree",
    type: "saree",
    category: "full_body",
    gender: "female",
    price: "INR 1,599",
    priceNumber: 1599,
    img: "assets/clothes/saree-04-pink-art-silk.jpg",
    color: "#be185d",
    pattern: "teal contrast border",
    wearing_instructions: "Casual graceful drape with free-flowing pallu",
    garment_desc: "a lightweight blush pink art silk saree with contrasting teal blue border",
    badge: "Pastel"
  }
];

if (typeof window !== "undefined") {
  window.DEMO_MODELS = DEMO_MODELS;
  window.UNIVERSAL_GARMENTS = UNIVERSAL_GARMENTS;
  window.SAREES = UNIVERSAL_GARMENTS; // Backwards compatibility
}
