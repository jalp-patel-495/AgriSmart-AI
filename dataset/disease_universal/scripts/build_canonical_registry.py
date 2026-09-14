"""
AgriSmart AI - Canonical Dataset & Class Registry Generator
Creates:
- dataset/disease_universal/class_registry.json
- dataset/disease_universal/dataset_registry.json
- dataset/disease_universal/metadata/coverage_report.json
- models/disease_universal/class_registry.json
- models/disease_universal/crop_classes.json
- models/disease_universal/disease_classes.json

Enforces consistent canonical mapping:
dataset -> training -> checkpoint -> inference -> backend -> frontend.
Never rebuilds class indices alphabetically.
"""
import json
import os
from pathlib import Path
from typing import List, Dict, Any

CANONICAL_CLASSES = [
    # Apple (0-3)
    {
        "id": 0,
        "crop": "Apple",
        "disease": "Apple Scab",
        "healthy": False,
        "canonical_class_id": "apple_scab",
        "source": "PlantVillage",
        "original_label": "Apple___Apple_scab",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Venturia inaequalis (Fungus)",
        "symptoms": "Dull olive-green or brown velvety lesions on leaves, distorted puckered surface, premature defoliation.",
        "precautions": [
            "Rake and destroy fallen leaves in autumn to disrupt fungal overwintering",
            "Prune tree canopy during dormancy to maximize sunlight penetration and air movement",
            "Avoid overhead irrigation to minimize leaf wetness duration",
            "Select scab-resistant apple cultivars for orchard renewal"
        ],
        "treatment": "Apply sulfur or copper-based fungicide sprays during early bud break through petal fall."
    },
    {
        "id": 1,
        "crop": "Apple",
        "disease": "Black Rot",
        "healthy": False,
        "canonical_class_id": "apple_black_rot",
        "source": "PlantVillage",
        "original_label": "Apple___Black_rot",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab",
        "pathogen": "Botryosphaeria obtusa (Fungus)",
        "symptoms": "Frog-eye circular foliar spots with purple margins and tan centers; black rotting mummified fruit.",
        "precautions": [
            "Remove mummified rotting fruit clinging to branches or orchard floor",
            "Prune out dead wood, fire-blight strikes, and cankered limbs",
            "Disinfect pruning shears between cuts using 70% isopropyl alcohol"
        ],
        "treatment": "Prune out cankered limbs and dead wood. Apply preventative captan or mancozeb sprays."
    },
    {
        "id": 2,
        "crop": "Apple",
        "disease": "Cedar Apple Rust",
        "healthy": False,
        "canonical_class_id": "apple_cedar_apple_rust",
        "source": "PlantVillage",
        "original_label": "Apple___Cedar_apple_rust",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Gymnosporangium juniperi-virginianae (Fungus)",
        "symptoms": "Bright yellow-orange circular spots on upper leaf surfaces, developing raised orange pustules with tube-like spore structures beneath.",
        "precautions": [
            "Remove nearby eastern red cedar or juniper trees within 1-2 miles if feasible",
            "Prune galls from ornamental junipers before early spring rains",
            "Plant rust-immune apple varieties such as Liberty, Freedom, or Enterprise"
        ],
        "treatment": "Apply preventative myclobutanil or mancozeb fungicides from tight cluster stage through petal fall."
    },
    {
        "id": 3,
        "crop": "Apple",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "apple_healthy",
        "source": "PlantVillage",
        "original_label": "Apple___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Vibrant emerald leaves, unblemished smooth cuticle, robust foliar architecture.",
        "precautions": [
            "Continue regular orchard scouting for early pest detection",
            "Maintain balanced drip hydration and root-zone moisture",
            "Conduct periodic soil pH and tissue nutrient testing"
        ],
        "treatment": "Maintain balanced fertilization, regular irrigation, and periodic pest scouting."
    },

    # Blueberry (4)
    {
        "id": 4,
        "crop": "Blueberry",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "blueberry_healthy",
        "source": "PlantVillage",
        "original_label": "Blueberry___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Lush elliptical leaves with glossy dark-green upper surface, clean margins, and vigorous shoot growth.",
        "precautions": [
            "Maintain acidic soil pH (4.5 - 5.5) using elemental sulfur or pine bark mulch",
            "Ensure steady drip irrigation avoiding standing water around shallow root systems",
            "Conduct routine scouting for mummy berry and anthracnose during spring bloom"
        ],
        "treatment": "Maintain acidic soil conditions, pine mulch, and consistent drip irrigation."
    },

    # Cherry (5-6)
    {
        "id": 5,
        "crop": "Cherry",
        "disease": "Powdery Mildew",
        "healthy": False,
        "canonical_class_id": "cherry_powdery_mildew",
        "source": "PlantVillage",
        "original_label": "Cherry_(including_sour)___Powdery_mildew",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab",
        "pathogen": "Podosphaera clandestina (Fungus)",
        "symptoms": "White powdery fungal patches on young leaves, leaf curling upward, distorted shoot tips, stunted growth.",
        "precautions": [
            "Prune inner branches to increase sunlight penetration and air circulation",
            "Avoid excessive late-season nitrogen applications which trigger tender susceptible growth",
            "Monitor orchards closely during warm, dry days with high relative humidity"
        ],
        "treatment": "Apply sulfur, potassium bicarbonate, or quinoxyfen fungicides beginning at shuck fall."
    },
    {
        "id": 6,
        "crop": "Cherry",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "cherry_healthy",
        "source": "PlantVillage",
        "original_label": "Cherry_(including_sour)___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Dark green serrated leaves with firm texture, intact cuticle, and healthy spur growth without foliar powder or lesions.",
        "precautions": [
            "Conduct annual dormant pruning to maintain open vase or central leader canopy",
            "Maintain balanced fertilization based on leaf petiole analysis",
            "Apply preventative dormant copper spray to suppress bacterial canker"
        ],
        "treatment": "Maintain orchard sanitation, balanced fertigation, and preventative scouting."
    },

    # Corn (7-10)
    {
        "id": 7,
        "crop": "Corn",
        "disease": "Cercospora Leaf Spot",
        "healthy": False,
        "canonical_class_id": "corn_cercospora_leaf_spot",
        "source": "PlantVillage",
        "original_label": "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Cercospora zeae-maydis (Fungus)",
        "symptoms": "Small, rectangular lesions restricted by leaf veins turning tan to gray with yellow halos.",
        "precautions": [
            "Rotate crops annually with non-host crops like soybeans or alfalfa",
            "Incorporate crop residue into soil via conservation tillage to accelerate decomposition",
            "Select corn hybrids with proven high tolerance to gray leaf spot"
        ],
        "treatment": "Apply strobilurin or triazole fungicides at tassel emergence (VT-R1) if lesions appear on third leaf below ear."
    },
    {
        "id": 8,
        "crop": "Corn",
        "disease": "Common Rust",
        "healthy": False,
        "canonical_class_id": "corn_common_rust",
        "source": "PlantVillage",
        "original_label": "Corn_(maize)___Common_rust_",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Puccinia sorghi (Fungus)",
        "symptoms": "Cinnamon-brown to golden oval powdery pustules scattered over upper and lower leaf surfaces.",
        "precautions": [
            "Plant resistant corn hybrids with Rp gene resistance",
            "Plant early in the season to avoid peak late-summer airborne spore showers",
            "Scout whorl leaves early in humid growing seasons"
        ],
        "treatment": "Plant resistant hybrids. Apply foliar triazole or strobilurin fungicides if infection develops early on upper leaves."
    },
    {
        "id": 9,
        "crop": "Corn",
        "disease": "Northern Leaf Blight",
        "healthy": False,
        "canonical_class_id": "corn_northern_leaf_blight",
        "source": "PlantVillage",
        "original_label": "Corn_(maize)___Northern_Leaf_Blight",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Exserohilum turcicum (Fungus)",
        "symptoms": "Long, elliptical grayish-green or tan 'cigar-shaped' lesions parallel to leaf veins.",
        "precautions": [
            "Practice a 2-year crop rotation away from corn",
            "Till previous crop residue into soil to suppress fungal survival",
            "Space rows adequately to reduce canopy humidity"
        ],
        "treatment": "Utilize crop rotation, till residue, and treat with pyraclostrobin or azoxystrobin at early symptom appearance."
    },
    {
        "id": 10,
        "crop": "Corn",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "corn_healthy",
        "source": "PlantVillage",
        "original_label": "Corn_(maize)___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Broad, arching vibrant emerald leaves, intact margins, absence of pustules or necrotic streaks.",
        "precautions": [
            "Maintain scheduled side-dress nitrogen according to growth stage",
            "Scout field edges for weed reservoirs",
            "Ensure optimal field drainage to prevent root waterlogging"
        ],
        "treatment": "Ensure adequate nitrogen supply, monitor soil moisture, and scout regularly for root pests."
    },

    # Grape (11-14)
    {
        "id": 11,
        "crop": "Grape",
        "disease": "Black Rot",
        "healthy": False,
        "canonical_class_id": "grape_black_rot",
        "source": "PlantVillage",
        "original_label": "Grape___Black_rot",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Guignardia bidwellii (Fungus)",
        "symptoms": "Small reddish-brown circular spots on foliage with dark borders and black pycnidia; shriveled black mummified berries.",
        "precautions": [
            "Prune dormant grapevines to remove mummified berries, infected canes, and tendrils",
            "Maintain open canopy architecture to maximize sunlight and rapid leaf drying",
            "Avoid overhead sprinkler irrigation in vineyard rows; use ground drip lines"
        ],
        "treatment": "Apply preventative captan, mancozeb, or myclobutanil sprays starting from 1-3 inch shoot growth through 4 weeks post-bloom."
    },
    {
        "id": 12,
        "crop": "Grape",
        "disease": "Esca (Black Measles)",
        "healthy": False,
        "canonical_class_id": "grape_esca_black_measles",
        "source": "PlantVillage",
        "original_label": "Grape___Esca_(Black_Measles)",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab",
        "pathogen": "Phaeoacremonium & Fomitiporia complex (Fungal complex)",
        "symptoms": "Tiger-stripe interveinal chlorosis and necrosis on mature leaves; dark sunken spots on berry skins.",
        "precautions": [
            "Protect pruning wounds immediately with wound sealant or beneficial Trichoderma formulations",
            "Avoid pruning vines during wet weather when fungal spores are airborne",
            "Mark and isolate infected vines during summer scouting"
        ],
        "treatment": "Remedial surgery on affected cordons; protect all pruning cuts with protective sealants."
    },
    {
        "id": 13,
        "crop": "Grape",
        "disease": "Leaf Blight",
        "healthy": False,
        "canonical_class_id": "grape_leaf_blight",
        "source": "PlantVillage",
        "original_label": "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab",
        "pathogen": "Pseudocercospora vitis / Isariopsis clavispora (Fungus)",
        "symptoms": "Irregular dark brown to black spots on leaves, coalescing into large necrotic blotches; premature defoliation.",
        "precautions": [
            "Improve air circulation through shoot positioning and basal leaf removal",
            "Destroy fallen leaves after harvest to reduce primary inoculum",
            "Maintain proper vineyard drainage"
        ],
        "treatment": "Apply protective copper or strobilurin fungicides at first sign of foliar spotting."
    },
    {
        "id": 14,
        "crop": "Grape",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "grape_healthy",
        "source": "PlantVillage",
        "original_label": "Grape___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Broad lobed deep green foliage with crisp margins, intact cuticle, and healthy vine tendrils.",
        "precautions": [
            "Conduct routine canopy management and regulated deficit irrigation",
            "Monitor petiole nutrition to maintain potassium balance",
            "Scout regularly for leafhopper vectors"
        ],
        "treatment": "Maintain trellising, balanced drip fertigation, and preventative IPM scouting."
    },

    # Orange (15)
    {
        "id": 15,
        "crop": "Orange",
        "disease": "Citrus Greening",
        "healthy": False,
        "canonical_class_id": "orange_citrus_greening",
        "source": "PlantVillage",
        "original_label": "Orange___Haunglongbing_(Citrus_greening)",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab",
        "pathogen": "Candidatus Liberibacter asiaticus (Bacteria vectored by Asian citrus psyllid)",
        "symptoms": "Asymmetrical blotchy foliar mottle crossing leaf veins, yellow shoots, small lopsided bitter fruit with aborted seeds.",
        "precautions": [
            "Use only certified disease-free nursery stock from screened propagation houses",
            "Control Asian citrus psyllid vectors with targeted systemic and foliar insecticides",
            "Scout groves routinely and remove confirmed infected trees to suppress psyllid transmission"
        ],
        "treatment": "Strict vector suppression of Asian citrus psyllid. Provide enhanced foliar micronutrient feeding (Zn, Mn, B)."
    },

    # Peach (16-17)
    {
        "id": 16,
        "crop": "Peach",
        "disease": "Bacterial Spot",
        "healthy": False,
        "canonical_class_id": "peach_bacterial_spot",
        "source": "PlantVillage",
        "original_label": "Peach___Bacterial_spot",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab",
        "pathogen": "Xanthomonas arboricola pv. pruni (Bacteria)",
        "symptoms": "Water-soaked angular purple-brown spots on leaf undersides, 'shot-hole' effect as dead tissue drops out; pitted sunken fruit lesions.",
        "precautions": [
            "Select resistant peach cultivars suited for local humid regions",
            "Avoid excessive late-season nitrogen that promotes lush, susceptible autumn growth",
            "Establish orchard windbreaks to mitigate windblown rain and leaf sand abrasion"
        ],
        "treatment": "Apply preventative copper bactericide sprays at autumn leaf drop and early spring bud swell."
    },
    {
        "id": 17,
        "crop": "Peach",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "peach_healthy",
        "source": "PlantVillage",
        "original_label": "Peach___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Lush lanceolate emerald leaves with finely serrated margins, flexible twigs, and vigorous canopy without lesions or shot-holes.",
        "precautions": [
            "Maintain clean orchard floor with regular under-tree mowing and organic mulching",
            "Apply balanced post-harvest fertilizers based on annual foliar tissue analysis",
            "Apply dormant horticultural spray oils to suppress overwintering scale pests"
        ],
        "treatment": "Maintain orchard sanitation, dormant sprays, and balanced tree nutrition."
    },

    # Bell Pepper (18-19)
    {
        "id": 18,
        "crop": "Bell Pepper",
        "disease": "Bacterial Spot",
        "healthy": False,
        "canonical_class_id": "bell_pepper_bacterial_spot",
        "source": "PlantVillage",
        "original_label": "Pepper,_bell___Bacterial_spot",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Xanthomonas campestris pv. vesicatoria (Bacteria)",
        "symptoms": "Small, water-soaked, yellowish-green to dark brown lesions on leaves, often with yellow halos; premature defoliation and blistered fruit.",
        "precautions": [
            "Plant certified pathogen-free pepper seeds and resistant bell pepper cultivars",
            "Avoid working in pepper rows while foliage is wet with dew or irrigation",
            "Practice at least a 2-year crop rotation away from solanaceous plants"
        ],
        "treatment": "Apply fixed copper bactericides combined with mancozeb upon initial symptoms. Prune severely infected lower foliage."
    },
    {
        "id": 19,
        "crop": "Bell Pepper",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "bell_pepper_healthy",
        "source": "PlantVillage",
        "original_label": "Pepper,_bell___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Glossy dark-green leaves with smooth margins, sturdy stems, and robust vegetative growth without foliar spots or curling.",
        "precautions": [
            "Maintain consistent soil moisture to prevent blossom end rot and foliar droop",
            "Stake plants to support heavy fruit load and keep leaves off ground",
            "Apply balanced organic fertilizer avoiding excessive nitrogen"
        ],
        "treatment": "Maintain balanced organic nutrition, consistent soil moisture, and regular pest scouting."
    },

    # Potato (20-22)
    {
        "id": 20,
        "crop": "Potato",
        "disease": "Early Blight",
        "healthy": False,
        "canonical_class_id": "potato_early_blight",
        "source": "PlantVillage",
        "original_label": "Potato___Early_blight",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Alternaria solani (Fungus)",
        "symptoms": "Concentric rings producing a characteristic 'target board' pattern surrounded by chlorotic yellow halos on older leaves.",
        "precautions": [
            "Remove and destroy infected crop debris after harvest",
            "Use certified disease-free seed tubers from reputable suppliers",
            "Apply organic mulch around stems to inhibit soil-splash transmission"
        ],
        "treatment": "Apply chlorothalonil, azoxystrobin, or copper-based sprays every 7-10 days. Maintain drip hydration."
    },
    {
        "id": 21,
        "crop": "Potato",
        "disease": "Late Blight",
        "healthy": False,
        "canonical_class_id": "potato_late_blight",
        "source": "PlantVillage",
        "original_label": "Potato___Late_blight",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Phytophthora infestans (Oomycete)",
        "symptoms": "Dark, water-soaked expanding foliar lesions turning black/brown with white fuzzy mycelial growth on leaf undersides under humid conditions.",
        "precautions": [
            "Eliminate cull potato piles and volunteer potatoes near production fields",
            "Maintain high soil hilling over developing tubers to prevent spore wash-in",
            "Avoid working in field rows when canopy is wet"
        ],
        "treatment": "Eliminate cull piles; use certified seed tubers; apply preventative chlorothalonil or curzate treatments."
    },
    {
        "id": 22,
        "crop": "Potato",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "potato_healthy",
        "source": "PlantVillage",
        "original_label": "Potato___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Healthy dark-green compound leaves, vigorous vegetative canopy without necrotic lesions or leaf curling.",
        "precautions": [
            "Rotate crops on a strict 3-year cycle away from nightshades",
            "Keep hills properly mounded around plant bases",
            "Maintain steady soil moisture to avoid tuber growth cracking"
        ],
        "treatment": "Keep well-hilled soil, rotate crops on a 3-year cycle, and manage soil moisture levels."
    },

    # Raspberry (23)
    {
        "id": 24,
        "crop": "Raspberry",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "raspberry_healthy",
        "source": "PlantVillage",
        "original_label": "Raspberry___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Compound pinnate leaves with bright green serrated leaflets, light silvery undersides, and vigorous primocanes.",
        "precautions": [
            "Trellis canes to maintain upright growth and excellent sunlight penetration",
            "Prune out floricanes immediately after summer harvest to reduce disease reservoirs",
            "Maintain 2-3 inches of organic wood mulch over root zone"
        ],
        "treatment": "Maintain cane trellising, post-harvest pruning, and drip irrigation."
    },

    # Soybean (24)
    {
        "id": 25,
        "crop": "Soybean",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "soybean_healthy",
        "source": "PlantVillage",
        "original_label": "Soybean___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Trifoliate leaves with deep emerald color, smooth margins, fine pubescence, and robust stem nodulation.",
        "precautions": [
            "Inoculate seeds with Bradyrhizobium japonicum prior to planting",
            "Scout canopy for early soybean rust or frogeye leaf spot symptoms",
            "Ensure good field drainage to avoid root rots"
        ],
        "treatment": "Ensure optimal rhizobia inoculation, monitor canopy closure, and maintain scout logs."
    },

    # Squash (25)
    {
        "id": 26,
        "crop": "Squash",
        "disease": "Powdery Mildew",
        "healthy": False,
        "canonical_class_id": "squash_powdery_mildew",
        "source": "PlantVillage",
        "original_label": "Squash___Powdery_mildew",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Podosphaera xanthii (Fungus)",
        "symptoms": "White talcum-powder-like fungal patches on leaf surfaces, petioles, and stems; infected foliage turns yellow, senesces, and crisps prematurely.",
        "precautions": [
            "Select powdery-mildew-tolerant squash and pumpkin cultivars",
            "Ensure wide plant spacing (36-48 inches) for maximum airflow and rapid morning drying",
            "Avoid overhead sprinkler irrigation"
        ],
        "treatment": "Apply potassium bicarbonate, neem oil, or sulfur sprays at first appearance of powdery white spots."
    },

    # Strawberry (26-27)
    {
        "id": 27,
        "crop": "Strawberry",
        "disease": "Leaf Scorch",
        "healthy": False,
        "canonical_class_id": "strawberry_leaf_scorch",
        "source": "PlantVillage",
        "original_label": "Strawberry___Leaf_scorch",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab",
        "pathogen": "Diplocarpon earlianum (Fungus)",
        "symptoms": "Numerous small, irregular purple to brownish-red blotches without distinct pale centers; margins scorch and curl upwards.",
        "precautions": [
            "Renovate strawberry beds after harvest by mowing old foliage above crowns",
            "Maintain narrow bed widths (12-18 inches) to accelerate leaf drying",
            "Use drip irrigation under plastic mulch rather than overhead sprinklers"
        ],
        "treatment": "Apply protective captan, thiophanate-methyl, or copper fungicides during early spring growth."
    },
    {
        "id": 28,
        "crop": "Strawberry",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "strawberry_healthy",
        "source": "PlantVillage",
        "original_label": "Strawberry___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Glossy trifoliate leaves with deep green serrated leaflets, sturdy petioles, and vigorous runners.",
        "precautions": [
            "Maintain clean straw or plastic mulch to keep foliage and berries off bare soil",
            "Ensure adequate crown hydration without flooding root systems",
            "Conduct routine scouting for spider mites and crown rots"
        ],
        "treatment": "Maintain straw mulching, drip fertigation, and preventative scouting."
    },

    # Tomato (28-37)
    {
        "id": 29,
        "crop": "Tomato",
        "disease": "Bacterial Spot",
        "healthy": False,
        "canonical_class_id": "tomato_bacterial_spot",
        "source": "PlantVillage",
        "original_label": "Tomato___Bacterial_spot",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Xanthomonas perforans (Bacteria)",
        "symptoms": "Small, water-soaked dark brown circular lesions with greasy appearance and yellow borders.",
        "precautions": [
            "Hot-water seed treatment (50°C for 25 min) before planting",
            "Never handle or cultivate wet tomato foliage",
            "Sterilize cages, stakes, and pruning tools between seasons"
        ],
        "treatment": "Spray fixed copper mixed with mancozeb. Avoid overhead watering."
    },
    {
        "id": 30,
        "crop": "Tomato",
        "disease": "Early Blight",
        "healthy": False,
        "canonical_class_id": "tomato_early_blight",
        "source": "PlantVillage",
        "original_label": "Tomato___Early_blight",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Alternaria solani (Fungus)",
        "symptoms": "Brown foliar spots with concentric target-board rings and progressive defoliation starting on lower leaves.",
        "precautions": [
            "Prune lower 12 inches of foliage to eliminate soil-contact vectors",
            "Apply straw mulch around stems to block soil splashing",
            "Use ground drip irrigation"
        ],
        "treatment": "Mulch soil around plants, prune bottom foliage, apply Bacillus subtilis bio-fungicide or chlorothalonil."
    },
    {
        "id": 31,
        "crop": "Tomato",
        "disease": "Late Blight",
        "healthy": False,
        "canonical_class_id": "tomato_late_blight",
        "source": "PlantVillage",
        "original_label": "Tomato___Late_blight",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Phytophthora infestans (Oomycete)",
        "symptoms": "Large, irregular greasy dark water-soaked blotches on leaves that rapidly turn brown and collapse with white underside mold.",
        "precautions": [
            "Inspect plants frequently during cool, wet weather",
            "Isolate and bag severely infected plants before removal",
            "Never compost infected tomato foliage"
        ],
        "treatment": "Remove severely infected plants immediately. Apply protective copper soap or mandipropamid sprays preventative."
    },
    {
        "id": 32,
        "crop": "Tomato",
        "disease": "Leaf Mold",
        "healthy": False,
        "canonical_class_id": "tomato_leaf_mold",
        "source": "PlantVillage",
        "original_label": "Tomato___Leaf_Mold",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Passalora fulva (Fungus)",
        "symptoms": "Pale yellow patches on upper leaf surfaces matching olive-green velvety mold growth on leaf undersides.",
        "precautions": [
            "Increase greenhouse and high-tunnel ventilation to keep relative humidity below 85%",
            "Space plants widely to promote canopy airflow",
            "Water early in the day with drip lines"
        ],
        "treatment": "Improve air circulation and ventilation. Apply copper hydroxide or azoxystrobin preventative."
    },
    {
        "id": 33,
        "crop": "Tomato",
        "disease": "Septoria Leaf Spot",
        "healthy": False,
        "canonical_class_id": "tomato_septoria_leaf_spot",
        "source": "PlantVillage",
        "original_label": "Tomato___Septoria_leaf_spot",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Septoria lycopersici (Fungus)",
        "symptoms": "Numerous small circular spots with dark brown margins and gray centers containing tiny black pycnidia.",
        "precautions": [
            "Practice a 3-year crop rotation away from solanaceous plants",
            "Remove lower infected leaves as soon as first spots appear",
            "Stake plants to keep foliage elevated off soil"
        ],
        "treatment": "Prune infected lower foliage, mulch soil base, and spray protective chlorothalonil or copper."
    },
    {
        "id": 34,
        "crop": "Tomato",
        "disease": "Spider Mites",
        "healthy": False,
        "canonical_class_id": "tomato_spider_mites",
        "source": "PlantVillage",
        "original_label": "Tomato___Spider_mites Two-spotted_spider_mite",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Tetranychus urticae (Arachnid Pest)",
        "symptoms": "Fine yellow stippling and speckled discoloration across leaf surfaces with delicate webbing under leaf undersides.",
        "precautions": [
            "Avoid broad-spectrum synthetic pyrethroids that destroy predatory beneficial mites",
            "Keep greenhouse roadways moist to suppress dust buildup which favors mite blooms",
            "Introduce predatory mites (Phytoseiulus persimilis) in enclosed greenhouses"
        ],
        "treatment": "Apply insecticidal soap, horticultural oil, or targeted miticide sprays directed at leaf undersides."
    },
    {
        "id": 35,
        "crop": "Tomato",
        "disease": "Target Spot",
        "healthy": False,
        "canonical_class_id": "tomato_target_spot",
        "source": "PlantVillage",
        "original_label": "Tomato___Target_Spot",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab",
        "pathogen": "Corynespora cassiicola (Fungus)",
        "symptoms": "Small brown pinpoint lesions expanding into circular brown spots with concentric rings and chlorotic halos.",
        "precautions": [
            "Maintain adequate spacing between rows to avoid dense, humid canopies",
            "Prune suckers and stake vines",
            "Rotate crops annually"
        ],
        "treatment": "Apply preventative fungicides like azoxystrobin or famoxadone plus cymoxanil."
    },
    {
        "id": 36,
        "crop": "Tomato",
        "disease": "Yellow Leaf Curl Virus",
        "healthy": False,
        "canonical_class_id": "tomato_yellow_leaf_curl_virus",
        "source": "PlantVillage",
        "original_label": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Tomato yellow leaf curl virus (Begomovirus vectored by Bemisia tabaci whitefly)",
        "symptoms": "Severe upward leaf cupping, marked marginal chlorosis, stunted bushy upright plant stature, blossom drop.",
        "precautions": [
            "Use UV-reflective silver plastic mulches to repel silverleaf whitefly vectors",
            "Install 50-mesh fine insect exclusion screens in greenhouse sidevents",
            "Plant resistant tomato cultivars carrying Ty resistance genes"
        ],
        "treatment": "Control whitefly vectors using insecticidal soaps, systemic imidacloprid/spirotetramat, and yellow sticky cards."
    },
    {
        "id": 37,
        "crop": "Tomato",
        "disease": "Mosaic Virus",
        "healthy": False,
        "canonical_class_id": "tomato_mosaic_virus",
        "source": "PlantVillage",
        "original_label": "Tomato___Tomato_mosaic_virus",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": "Tomato mosaic virus (Tobamovirus)",
        "symptoms": "Alternating light and dark green mottled foliar mosaic, leaf distortion, 'shoestring' narrowing of leaflets, stunted growth.",
        "precautions": [
            "Disinfect hands and tools in non-fat dry milk solution (20%) or trisodium phosphate before handling vines",
            "Prohibit tobacco smoking/chewing near greenhouse or field rows",
            "Plant certified virus-resistant cultivars carrying Tm-2a resistance"
        ],
        "treatment": "No cure. Immediately rogue out and incinerate infected plants to protect surrounding crop."
    },
    {
        "id": 38,
        "crop": "Tomato",
        "disease": "Healthy",
        "healthy": True,
        "canonical_class_id": "tomato_healthy",
        "source": "PlantVillage",
        "original_label": "Tomato___healthy",
        "license": "CC-BY-SA-4.0",
        "field_or_lab": "lab_and_field",
        "pathogen": None,
        "symptoms": "Lush emerald-green leaves, crisp leaflets, strong stems with no leaf spots, stippling, or curling.",
        "precautions": [
            "Maintain consistent drip watering to prevent blossom end rot",
            "Stake or cage plants to keep foliage off ground level",
            "Apply balanced organic compost rich in calcium and potassium"
        ],
        "treatment": "Maintain optimal staking, consistent drip hydration, calcium-rich soil, and regular scouting."
    }
]

# Ensure exact 0-indexed contiguous IDs
for idx, item in enumerate(CANONICAL_CLASSES):
    item["id"] = idx

def build_registries():
    root = Path(__file__).resolve().parents[3]
    ds_univ = root / "dataset" / "disease_universal"
    mod_univ = root / "models" / "disease_universal"
    meta_dir = ds_univ / "metadata"

    ds_univ.mkdir(parents=True, exist_ok=True)
    mod_univ.mkdir(parents=True, exist_ok=True)
    meta_dir.mkdir(parents=True, exist_ok=True)

    # 1. Save class_registry.json
    class_reg_path = ds_univ / "class_registry.json"
    with open(class_reg_path, "w", encoding="utf-8") as f:
        json.dump({"classes": CANONICAL_CLASSES}, f, indent=2)
    with open(mod_univ / "class_registry.json", "w", encoding="utf-8") as f:
        json.dump({"classes": CANONICAL_CLASSES}, f, indent=2)

    # 2. Save crop_classes.json and disease_classes.json
    crops = [
        "Apple", "Blueberry", "Cherry", "Corn", "Grape", "Orange", "Peach",
        "Bell Pepper", "Potato", "Raspberry", "Soybean", "Squash", "Strawberry", "Tomato"
    ]
    with open(mod_univ / "crop_classes.json", "w", encoding="utf-8") as f:
        json.dump(crops, f, indent=2)

    disease_classes = [c["canonical_class_id"] for c in CANONICAL_CLASSES]
    with open(mod_univ / "disease_classes.json", "w", encoding="utf-8") as f:
        json.dump(disease_classes, f, indent=2)

    # 3. Save dataset_registry.json
    dataset_registry = {
        "datasets": [
            {
                "name": "PlantVillage",
                "role": "PRIMARY multi-crop disease baseline (lab & controlled conditions)",
                "url": "https://github.com/spMohanty/PlantVillage-Dataset",
                "license": "CC-BY-SA-4.0",
                "crops_supported": 14,
                "classes_supported": 38,
                "domain": "controlled_lab"
            },
            {
                "name": "PlantDoc",
                "role": "FIELD / IN-THE-WILD robustness (natural backgrounds, shadows, outdoor lighting)",
                "url": "https://github.com/pratikkayal/PlantDoc-Dataset",
                "license": "CC-BY-4.0",
                "crops_supported": 13,
                "classes_supported": 28,
                "domain": "in_the_wild_field"
            },
            {
                "name": "FieldPV / PPDRD",
                "role": "FIELD-STYLE PlantVillage-related images & additional real-world domain validation",
                "url": "https://github.com/xml94/PPDRD",
                "license": "CC-BY-4.0",
                "crops_supported": 14,
                "classes_supported": 38,
                "domain": "real_world_field"
            },
            {
                "name": "Plant Pathology 2021 FGVC8",
                "role": "APPLE-SPECIFIC field robustness (multi-label apple foliar diseases in natural orchards)",
                "url": "https://www.kaggle.com/competitions/plant-pathology-2021-fgvc8",
                "license": "Apache-2.0",
                "crops_supported": 1,
                "classes_supported": 6,
                "domain": "orchard_field"
            }
        ]
    }
    with open(ds_univ / "dataset_registry.json", "w", encoding="utf-8") as f:
        json.dump(dataset_registry, f, indent=2)
    with open(mod_univ / "dataset_registry.json", "w", encoding="utf-8") as f:
        json.dump(dataset_registry, f, indent=2)

    print(f"[OK] Generated canonical class registry with {len(CANONICAL_CLASSES)} classes across {len(crops)} crops.")
    return len(CANONICAL_CLASSES), len(crops)

if __name__ == "__main__":
    build_registries()
