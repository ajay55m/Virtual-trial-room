/**
 * VirtualFit AI Studio - Dataset
 * Global constants for Demo Models and Sarees Catalog
 */

const DEMO_MODELS = [
  { 
    id: 1, 
    name: "Demo Model 1 - Aisha", 
    img: "assets/models/model-1.jpg" 
  },
  { 
    id: 2, 
    name: "Demo Model 2 - Priya", 
    img: "assets/models/model-2.jpg" 
  },
  { 
    id: 3, 
    name: "Demo Model 3 - Kavya", 
    img: "assets/models/model-3.jpg" 
  },
  { 
    id: 4, 
    name: "Demo Model 4 - Meera", 
    img: "assets/models/model-4.jpg" 
  }
];

const SAREES = [
  {
    id: "saree-01",
    name: "Royal Sapphire Blue Banarasi Silk Saree",
    price: "INR 2499",
    priceNumber: 2499,
    img: "assets/clothes/saree-01-blue-banarasi.jpg",
    category: "dresses",
    garment_desc: "a royal sapphire blue banarasi silk saree with silver brocade work and silver border, traditional indian draping with pleats",
    color: "#1e3a8a"
  },
  {
    id: "saree-02",
    name: "Crimson Red Banarasi Silk Saree",
    price: "INR 2799",
    priceNumber: 2799,
    img: "assets/clothes/saree-02-red-banarasi.jpg",
    category: "dresses",
    garment_desc: "a crimson red banarasi silk saree with golden zari border, traditional indian draping",
    color: "#991b1b"
  },
  {
    id: "saree-03",
    name: "Emerald Green Kanjivaram Silk Saree",
    price: "INR 3299",
    priceNumber: 3299,
    img: "assets/clothes/saree-03-green-kanjivaram.jpg",
    category: "dresses",
    garment_desc: "an emerald green kanjivaram silk saree with golden border, traditional south indian draping",
    color: "#065f46"
  },
  {
    id: "saree-04",
    name: "Pink Art Silk Saree with Teal Border",
    price: "INR 1599",
    priceNumber: 1599,
    img: "assets/clothes/saree-04-pink-art-silk.jpg",
    category: "dresses",
    garment_desc: "a women pink art silk saree with teal blue border, traditional draping",
    color: "#db2777"
  },
  {
    id: "saree-05",
    name: "Golden Yellow Chanderi Saree",
    price: "INR 1899",
    priceNumber: 1899,
    img: "assets/clothes/saree-05-yellow-chanderi.jpg",
    category: "dresses",
    garment_desc: "a golden yellow chanderi embroidered saree, traditional indian draping",
    color: "#d97706"
  },
  {
    id: "saree-06",
    name: "Black Kota Cotton Saree",
    price: "INR 1399",
    priceNumber: 1399,
    img: "assets/clothes/saree-06-black-kota.jpg",
    category: "dresses",
    garment_desc: "a women black kota cotton saree with silver motifs and green blouse, traditional draping",
    color: "#18181b"
  },
  {
    id: "saree-07",
    name: "Grey with Pink Art Silk Saree",
    price: "INR 1499",
    priceNumber: 1499,
    img: "assets/clothes/saree-07-grey-pink.jpg",
    category: "dresses",
    garment_desc: "a women grey saree with pink art silk border, traditional draping",
    color: "#4b5563"
  },
  {
    id: "saree-08",
    name: "Peach Floral Cotton Saree",
    price: "INR 1199",
    priceNumber: 1199,
    img: "assets/clothes/saree-08-peach-floral.jpg",
    category: "dresses",
    garment_desc: "a peach floral cotton saree for women, traditional draping",
    color: "#ea580c"
  },
  {
    id: "saree-09",
    name: "Maroon Silk Saree with Gold Border",
    price: "INR 2699",
    priceNumber: 2699,
    img: "assets/clothes/saree-09-maroon-silk.jpg",
    category: "dresses",
    garment_desc: "a maroon silk saree with heavy gold border, traditional indian draping",
    color: "#831843"
  },
  {
    id: "saree-10",
    name: "Turquoise Blue Silk Saree",
    price: "INR 2299",
    priceNumber: 2299,
    img: "assets/clothes/saree-10-turquoise-silk.jpg",
    category: "dresses",
    garment_desc: "a turquoise blue silk saree with silver border, traditional draping",
    color: "#0891b2"
  },
  {
    id: "saree-11",
    name: "Orange Banarasi Saree",
    price: "INR 2599",
    priceNumber: 2599,
    img: "assets/clothes/saree-11-orange-banarasi.jpg",
    category: "dresses",
    garment_desc: "an orange banarasi silk saree with gold zari work, traditional draping",
    color: "#c2410c"
  },
  {
    id: "saree-12",
    name: "Light Blue Art Silk Saree",
    price: "INR 1699",
    priceNumber: 1699,
    img: "assets/clothes/saree-12-light-blue.jpg",
    category: "dresses",
    garment_desc: "a light blue art silk saree with pink border, traditional draping",
    color: "#0284c7"
  }
];

// Attach to window object for reliable browser access
if (typeof window !== 'undefined') {
  window.DEMO_MODELS = DEMO_MODELS;
  window.SAREES = SAREES;
}

