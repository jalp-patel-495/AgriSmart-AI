"""
AgriSmart AI – Verified Agronomic Knowledge & Disease Advisory Mapping
Provides symptoms, prevention, management, and farmer-friendly advice for canonical crop diseases.
Does NOT provide dangerous or unverified chemical dosages.
"""
from typing import Dict, Any, List

DISEASE_KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    "Apple Scab": {
        "crop": "Apple",
        "disease": "Apple Scab",
        "pathogen": "Venturia inaequalis (Fungus)",
        "symptoms": "Olive-green to dark brown velvety spots on leaf surfaces and fruit. Leaf puckering and premature drop.",
        "prevention": "Rake and destroy fallen foliage in autumn; prune canopies during winter dormancy for optimal airflow.",
        "management": "Avoid overhead watering; spray preventative sulfur or copper soaps during green tip to petal fall stage.",
        "farmer_advice": "Prune interior branches to reduce humidity inside tree canopies. Remove leaf debris before winter."
    },
    "Black Rot": {
        "crop": "Apple",
        "disease": "Black Rot",
        "pathogen": "Botryosphaeria obtusa (Fungus)",
        "symptoms": "Circular leaf spots with purple margins ('frog-eye' appearance), black rotting mummified fruit.",
        "prevention": "Prune out dead wood, fire-blight strikes, and cankers. Disinfect pruning shears between trees.",
        "management": "Dispose of fallen mummies and wild hosts nearby. Apply protective broad-spectrum fungicides if pressure is high.",
        "farmer_advice": "Scout for mummified fruit hanging on branches from last season. Pruning diseased twigs is the most effective defense."
    },
    "Common Rust": {
        "crop": "Corn",
        "disease": "Common Rust",
        "pathogen": "Puccinia sorghi (Fungus)",
        "symptoms": "Golden-brown to cinnamon powdery pustules scattered across both leaf surfaces.",
        "prevention": "Plant resistant hybrid maize seed varieties; practice regular field scouting during cool, damp weather.",
        "management": "Deploy foliar fungicides only if pustules appear prior to tasseling on susceptible hybrids.",
        "farmer_advice": "Rust spores travel on wind. Resistant hybrids provide the best long-term control without requiring repeated sprays."
    },
    "Northern Leaf Blight": {
        "crop": "Corn",
        "disease": "Northern Leaf Blight",
        "pathogen": "Exserohilum turcicum (Fungus)",
        "symptoms": "Long, elliptical grayish-green or tan cigar-shaped lesions (1-6 inches long) parallel to leaf veins.",
        "prevention": "Rotate crops with non-grasses; till crop residue where erosion permits to encourage decomposition.",
        "management": "Select resistant seed; apply labeled protective fungicides if lesions reach upper leaves before silking.",
        "farmer_advice": "Lesions reduce photosynthetic leaf area. Ensure field drainage and avoid continuous corn-on-corn planting."
    },
    "Early Blight": {
        "crop": "Potato / Tomato",
        "disease": "Early Blight",
        "pathogen": "Alternaria solani (Fungus)",
        "symptoms": "Dark brown to black target-like spots with concentric rings, surrounded by chlorotic yellow halos on older leaves.",
        "prevention": "Mulch soil around plant stems to prevent soil splashing; stake plants and maintain wide spacing.",
        "management": "Remove lower affected leaves early; apply copper or chlorothalonil-based protective sprays every 7-10 days in humid periods.",
        "farmer_advice": "Early Blight begins from the bottom leaves upward. Water at the base with drip lines rather than overhead sprinklers."
    },
    "Late Blight": {
        "crop": "Potato / Tomato",
        "disease": "Late Blight",
        "pathogen": "Phytophthora infestans (Oomycete)",
        "symptoms": "Large, irregular water-soaked pale-to-dark brown lesions that enlarge rapidly; white velvety mold underneath in high humidity.",
        "prevention": "Plant only certified disease-free seed tubers; eliminate volunteer potato/tomato plants.",
        "management": "Destroy heavily infected plants immediately to protect neighboring fields; apply targeted protective fungicides ahead of cool, wet weather.",
        "farmer_advice": "Late Blight spreads extremely fast in cool, wet conditions (15-20°C). Inspect fields daily after continuous rains."
    },
    "Bacterial Spot": {
        "crop": "Tomato / Bell Pepper / Peach",
        "disease": "Bacterial Spot",
        "pathogen": "Xanthomonas spp. (Bacteria)",
        "symptoms": "Small, angular dark water-soaked spots on foliage, often with yellow halos; leaves may turn brown, drop, or develop shot-holes.",
        "prevention": "Use certified pathogen-free seeds; avoid working in fields when plants are wet.",
        "management": "Apply copper-mancozeb tank mixes preventatively; sanitize stakes, pruning shears, and field tools.",
        "farmer_advice": "Bacteria enter through stomata and wounds. Do not prune or cultivate while foliage is wet from dew or rain."
    },
    "Grape Black Rot": {
        "crop": "Grape",
        "disease": "Black Rot",
        "pathogen": "Guignardia bidwellii (Fungus)",
        "symptoms": "Reddish-brown circular spots on foliage with dark margins and tiny black pycnidia; shriveled black mummified berries on clusters.",
        "prevention": "Prune dormant vines to remove mummies and infected canes. Ensure an open trellis canopy for rapid leaf drying.",
        "management": "Apply preventative captan, mancozeb, or myclobutanil sprays from early shoot emergence until 4 weeks after bloom.",
        "farmer_advice": "Mummified berries hanging on vines are the primary overwintering source of infection. Prune out and destroy them before bud break."
    },
    "Bell Pepper Bacterial Spot": {
        "crop": "Bell Pepper",
        "disease": "Bacterial Spot",
        "pathogen": "Xanthomonas campestris pv. vesicatoria (Bacteria)",
        "symptoms": "Small water-soaked yellowish-green to brown lesions on leaves, surrounded by yellow halos; premature defoliation and blistered fruit lesions.",
        "prevention": "Use certified pathogen-free seed; practice 2-year crop rotation; use drip irrigation instead of overhead sprinklers.",
        "management": "Apply fixed copper bactericide combined with mancozeb upon first symptom appearance. Prune severely affected lower leaves.",
        "farmer_advice": "Avoid touching or cultivating pepper rows while dew is on foliage. Drip irrigation prevents splash spread."
    },
    "Peach Bacterial Spot": {
        "crop": "Peach",
        "disease": "Bacterial Spot",
        "pathogen": "Xanthomonas arboricola pv. pruni (Bacteria)",
        "symptoms": "Water-soaked angular purple-brown spots on leaf undersides, 'shot-hole' effect as dead centers fall out; pitting on fruit.",
        "prevention": "Plant resistant cultivars in well-drained sandy loam soil. Avoid excessive late nitrogen fertilizer.",
        "management": "Apply preventative copper sprays at autumn leaf drop and early spring bud swell. Oxytetracycline during shuck split if pressure is high.",
        "farmer_advice": "Prune peach trees to maintain an open-center vase for maximum sunlight penetration and rapid air drying."
    },
    "Healthy": {
        "crop": "Multiple Crops",
        "disease": "Healthy (No Pathologies Detected)",
        "pathogen": "None",
        "symptoms": "Vibrant uniform green foliage, unblemished leaf surfaces, normal cell turgor, no visible lesions.",
        "prevention": "Maintain balanced nitrogen, phosphorus, and potassium fertilization based on soil testing.",
        "management": "Continue regular field scouting, drip irrigation, and integrated pest management (IPM) practices.",
        "farmer_advice": "Your crop foliage is healthy! Maintain consistent watering schedule and scout weekly for early warning signs."
    }
}


def get_disease_info(crop_name: str, disease_name: str) -> Dict[str, Any]:
    """
    Returns verified disease advisory information matching the detected crop and disease.
    """
    # Direct match lookup
    clean_d = disease_name.strip()
    if clean_d in DISEASE_KNOWLEDGE_BASE:
        return DISEASE_KNOWLEDGE_BASE[clean_d]

    # Partial / substring match
    for key, info in DISEASE_KNOWLEDGE_BASE.items():
        if key.lower() in clean_d.lower() or clean_d.lower() in key.lower():
            return info

    if "healthy" in clean_d.lower():
        return DISEASE_KNOWLEDGE_BASE["Healthy"]

    # Fallback generic safe agronomy advice
    return {
        "crop": crop_name,
        "disease": disease_name,
        "pathogen": "Identified Foliar Pathogen",
        "symptoms": f"Visible leaf lesions or abnormal pigmentation identified as {disease_name}.",
        "prevention": "Improve air circulation through balanced pruning; avoid wetting leaves during irrigation.",
        "management": "Consult local agronomy extension services for approved regional management protocols.",
        "farmer_advice": f"Isolate affected {crop_name} leaves to prevent spread. Verify with local agricultural extension specialist."
    }
