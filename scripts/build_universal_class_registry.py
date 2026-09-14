"""
AgriSmart AI – Universal Plant Disease Canonical Class Registry Builder
Generates canonical crop-disease mapping, dataset registry, and taxonomy records
based strictly on legitimate datasets (PlantVillage 54,305 images across 14 crops, 
PlantDoc 2,585 in-the-wild images across 13 species, MVPDR/PlantWild).
"""

import os
import json
from pathlib import Path

ROOT_DIR = Path(r"j:\AGRISMART_AI")
DATASET_DIR = ROOT_DIR / "dataset" / ".plantvillage_cache" / "raw" / "color"
OUTPUT_DIR = ROOT_DIR / "models" / "disease_universal"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "crop_classifier").mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "disease_classifiers").mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "ood").mkdir(parents=True, exist_ok=True)

# 14 Canonical Crops
CROPS = [
    {"id": 0, "name": "Apple", "scientific_name": "Malus domestica", "family": "Rosaceae"},
    {"id": 1, "name": "Blueberry", "scientific_name": "Vaccinium corymbosum", "family": "Ericaceae"},
    {"id": 2, "name": "Cherry", "scientific_name": "Prunus avium / Prunus cerasus", "family": "Rosaceae"},
    {"id": 3, "name": "Corn", "scientific_name": "Zea mays", "family": "Poaceae"},
    {"id": 4, "name": "Grape", "scientific_name": "Vitis vinifera", "family": "Vitaceae"},
    {"id": 5, "name": "Orange", "scientific_name": "Citrus sinensis", "family": "Rutaceae"},
    {"id": 6, "name": "Peach", "scientific_name": "Prunus persica", "family": "Rosaceae"},
    {"id": 7, "name": "Pepper, bell", "scientific_name": "Capsicum annuum", "family": "Solanaceae"},
    {"id": 8, "name": "Potato", "scientific_name": "Solanum tuberosum", "family": "Solanaceae"},
    {"id": 9, "name": "Raspberry", "scientific_name": "Rubus idaeus", "family": "Rosaceae"},
    {"id": 10, "name": "Soybean", "scientific_name": "Glycine max", "family": "Fabaceae"},
    {"id": 11, "name": "Squash", "scientific_name": "Cucurbita pepo", "family": "Cucurbitaceae"},
    {"id": 12, "name": "Strawberry", "scientific_name": "Fragaria × ananassa", "family": "Rosaceae"},
    {"id": 13, "name": "Tomato", "scientific_name": "Solanum lycopersicum", "family": "Solanaceae"}
]

CROP_NAME_TO_ID = {c["name"]: c["id"] for c in CROPS}

# 38 Canonical Classes with rich agronomy data
RAW_CLASS_DEFS = [
    {
        "raw_name": "Apple___Apple_scab",
        "crop_name": "Apple",
        "disease_name": "Apple Scab",
        "healthy": False,
        "pathogen": "Venturia inaequalis (Fungus)",
        "symptoms": "Olive-green to dark brown velvety lesions on leaf surfaces and fruit. Leaves may wrinkle and drop prematurely.",
        "prevention": "Rake and destroy fallen leaves in autumn. Prune tree canopies to improve airflow and solar penetration.",
        "management": "Apply protective copper or sulfur fungicides at green-tip stage before rain events. Avoid overhead irrigation.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Apple___Black_rot",
        "crop_name": "Apple",
        "disease_name": "Black Rot",
        "healthy": False,
        "pathogen": "Botryosphaeria obtusa (Fungus)",
        "symptoms": "Frog-eye leaf spots with purple borders and tan centers; black rotting mummified fruit on tree twigs.",
        "prevention": "Prune out dead wood, fire-blight cankers, and mummified fruit during winter dormancy.",
        "management": "Remove overwintering fruit mummies. Apply preventative broad-spectrum fungicides from pink-bud stage.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Apple___Cedar_apple_rust",
        "crop_name": "Apple",
        "disease_name": "Cedar Apple Rust",
        "healthy": False,
        "pathogen": "Gymnosporangium juniperi-virginianae (Fungus)",
        "symptoms": "Bright yellow-orange or reddish circular spots on the upper leaf surface; cup-shaped fungal aecia underneath.",
        "prevention": "Remove nearby eastern red cedar (Juniperus virginiana) trees within 1-2 miles if feasible.",
        "management": "Plant rust-resistant apple cultivars; apply protective triazole or sterol-inhibiting fungicides from pink bud through petal fall.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Apple___healthy",
        "crop_name": "Apple",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Healthy green foliage with smooth margins, clear venation, and absence of fungal or bacterial lesions.",
        "prevention": "Maintain balanced annual fertilization, regular dormant pruning, and routine canopy scouting.",
        "management": "Continue regular pest monitoring and orchard hygiene practices.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Blueberry___healthy",
        "crop_name": "Blueberry",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Vibrant green elliptical leaves with intact surface cuticle and vigorous shoot growth.",
        "prevention": "Maintain acidic soil pH (4.5–5.2) with pine bark or elemental sulfur; mulch with organic wood chips.",
        "management": "Ensure adequate drip irrigation and routine foliar nutrient testing.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Cherry_(including_sour)___Powdery_mildew",
        "crop_name": "Cherry",
        "disease_name": "Powdery Mildew",
        "healthy": False,
        "pathogen": "Podosphaera clandestina (Fungus)",
        "symptoms": "White powdery fungal mycelium on leaves and young shoots; curled, stunted, or distorted young foliage.",
        "prevention": "Prune interior branches to increase sunlight and reduce localized humidity; avoid high nitrogen fertilization.",
        "management": "Apply horticultural oils, potassium bicarbonate, or sulfur sprays at early foliar emergence.",
        "dataset_sources": ["PlantVillage"],
        "field_condition": "Lab"
    },
    {
        "raw_name": "Cherry_(including_sour)___healthy",
        "crop_name": "Cherry",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Deep green serrated cherry foliage free of powdery coatings, shot-hole necrosis, or fungal spots.",
        "prevention": "Maintain orchard sanitation, winter dormant sprays, and balanced irrigation schedules.",
        "management": "Continue routine visual field checks and orchard floor weed control.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
        "crop_name": "Corn",
        "disease_name": "Cercospora Gray Leaf Spot",
        "healthy": False,
        "pathogen": "Cercospora zeae-maydis (Fungus)",
        "symptoms": "Rectangular, tan to grayish-brown lesions bordered strictly by leaf veins, creating sharp linear lesions.",
        "prevention": "Rotate with non-host crops like soybean; incorporate crop residues to encourage fungal degradation.",
        "management": "Plant resistant hybrid seed; apply labeled strobilurin or triazole fungicides if lesions reach ear leaves at silking.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Corn_(maize)___Common_rust_",
        "crop_name": "Corn",
        "disease_name": "Common Rust",
        "healthy": False,
        "pathogen": "Puccinia sorghi (Fungus)",
        "symptoms": "Cinnamon-brown to reddish powdery pustules scattered over both upper and lower corn leaf surfaces.",
        "prevention": "Plant resistant hybrid maize varieties; scout regularly during cool, humid periods.",
        "management": "Fungicide applications are rarely necessary on resistant hybrids; treat susceptible seed production fields if disease is severe before tasseling.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Corn_(maize)___Northern_Leaf_Blight",
        "crop_name": "Corn",
        "disease_name": "Northern Leaf Blight",
        "healthy": False,
        "pathogen": "Exserohilum turcicum (Fungus)",
        "symptoms": "Long, elliptical cigar-shaped grayish-green or tan lesions (1-6 inches long) parallel to veins.",
        "prevention": "Practice 2-year crop rotation; till infected residues where soil erosion guidelines allow.",
        "management": "Select resistant hybrids with Ht-gene resistance; apply foliar fungicides if lesions appear on third leaf below ear leaf before silking.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Corn_(maize)___healthy",
        "crop_name": "Corn",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Robust, upright green leaves with prominent midribs and no pustules, streaks, or necrotic blights.",
        "prevention": "Ensure balanced nitrogen and potassium fertilization; practice weed control and optimal plant population density.",
        "management": "Standard agronomic monitoring during vegetative and reproductive stages.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Grape___Black_rot",
        "crop_name": "Grape",
        "disease_name": "Black Rot",
        "healthy": False,
        "pathogen": "Guignardia bidwellii (Fungus)",
        "symptoms": "Small reddish-brown circular spots on leaves with tiny black pycnidia; shriveled black mummified berries.",
        "prevention": "Prune out old infected canes and remove mummies during winter pruning; open vine canopy for leaf aeration.",
        "management": "Apply preventative protectant fungicides (mancozeb, captan) starting at 1-inch shoot growth through post-bloom.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Grape___Esca_(Black_Measles)",
        "crop_name": "Grape",
        "disease_name": "Esca (Black Measles)",
        "healthy": False,
        "pathogen": "Fungal complex (Phaeomoniella chlamydospora, Phaeoacremonium aleophilum)",
        "symptoms": "Interveinal tiger-stripe yellow/reddish necrotic leaf patterns; dark spotty flecking on berry skins.",
        "prevention": "Disinfect pruning equipment between vines; protect large pruning cuts with wound sealants; delay pruning until late winter.",
        "management": "Prune out diseased cordon wood back to healthy tissue; remove severely dead vines from vineyard.",
        "dataset_sources": ["PlantVillage"],
        "field_condition": "Lab"
    },
    {
        "raw_name": "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
        "crop_name": "Grape",
        "disease_name": "Leaf Blight (Isariopsis Leaf Spot)",
        "healthy": False,
        "pathogen": "Pseudocercospora vitis (Fungus)",
        "symptoms": "Irregular dark reddish-brown foliar spots, often coalescing to cause premature leaf yellowing and defoliation.",
        "prevention": "Maintain proper vineyard canopy management to allow fast drying after rainfall; destroy leaf litter.",
        "management": "Apply protective copper or broad-spectrum fungicides after harvest or during early symptom onset.",
        "dataset_sources": ["PlantVillage"],
        "field_condition": "Lab"
    },
    {
        "raw_name": "Grape___healthy",
        "crop_name": "Grape",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Broad lobed green grape leaves with clean margins and healthy petiole attachments without foliar discoloration.",
        "prevention": "Provide balanced shoot positioning, suckering, and leaf pulling in the fruiting zone.",
        "management": "Regular scouting for mildew and berry moth activity.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Orange___Haunglongbing_(Citrus_greening)",
        "crop_name": "Orange",
        "disease_name": "Huanglongbing (Citrus Greening)",
        "healthy": False,
        "pathogen": "Candidatus Liberibacter asiaticus (Bacteria)",
        "symptoms": "Asymmetrical blotchy foliar mottle crossing veins; yellow shoots; small, lopsided bitter fruit with aborted seeds.",
        "prevention": "Plant only certified disease-free nursery citrus trees; control Asian citrus psyllid vectors with registered programs.",
        "management": "Scout for psyllids; remove confirmed HLB-infected trees promptly to protect surrounding groves.",
        "dataset_sources": ["PlantVillage"],
        "field_condition": "Lab"
    },
    {
        "raw_name": "Peach___Bacterial_spot",
        "crop_name": "Peach",
        "disease_name": "Bacterial Spot",
        "healthy": False,
        "pathogen": "Xanthomonas arboricola pv. pruni (Bacteria)",
        "symptoms": "Water-soaked angular purple-brown spots on leaf undersides, 'shot-hole' effect as dead centers fall out; pitting on fruit.",
        "prevention": "Plant resistant cultivars in well-drained sandy loam soil; avoid excessive late nitrogen applications.",
        "management": "Apply preventative copper sprays at autumn leaf drop and early spring bud swell; oxytetracycline during shuck split.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Peach___healthy",
        "crop_name": "Peach",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Lanceolate green peach leaves without chlorosis, bacterial shot holes, or leaf curl distortion.",
        "prevention": "Annual open-center vase pruning, balanced fertigation, and preventative dormant copper applications.",
        "management": "Regular scouting for scale, borers, and foliar spotting.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Pepper,_bell___Bacterial_spot",
        "crop_name": "Pepper, bell",
        "disease_name": "Bacterial Spot",
        "healthy": False,
        "pathogen": "Xanthomonas campestris pv. vesicatoria (Bacteria)",
        "symptoms": "Small water-soaked yellowish-green to brown lesions on leaves, surrounded by yellow halos; premature leaf drop.",
        "prevention": "Use certified pathogen-free seed; practice 2-year crop rotation; use drip irrigation instead of overhead sprinklers.",
        "management": "Apply fixed copper bactericide combined with mancozeb upon first symptom appearance; remove severely infected plants.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Pepper,_bell___healthy",
        "crop_name": "Pepper, bell",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Glossy green leaves with uniform coloration, firm texture, and vigorous floral bud development.",
        "prevention": "Maintain consistent soil moisture, adequate calcium nutrition, and weed-free row middles.",
        "management": "Scout weekly for aphids, thrips, and early foliar spotting.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Potato___Early_blight",
        "crop_name": "Potato",
        "disease_name": "Early Blight",
        "healthy": False,
        "pathogen": "Alternaria solani (Fungus)",
        "symptoms": "Dark brown to black target-like spots with concentric rings, surrounded by yellow halos on older lower leaves.",
        "prevention": "Ensure good crop nutrition (especially nitrogen); maintain wide plant spacing to improve canopy drying.",
        "management": "Remove lower infected foliage; apply preventative protective chlorothalonil, mancozeb, or azoxystrobin sprays.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Potato___Late_blight",
        "crop_name": "Potato",
        "disease_name": "Late Blight",
        "healthy": False,
        "pathogen": "Phytophthora infestans (Oomycete)",
        "symptoms": "Large, irregular water-soaked pale-to-dark brown lesions that enlarge rapidly; white velvety mold underneath in high humidity.",
        "prevention": "Plant only certified disease-free seed tubers; eliminate volunteer potato/tomato cull piles.",
        "management": "Destroy heavily infected plants immediately to protect neighboring fields; apply targeted protective fungicides ahead of cool, wet weather.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Potato___healthy",
        "crop_name": "Potato",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Dense, healthy potato compound leaves with vibrant green leaflets, free of necrosis or water-soaked lesions.",
        "prevention": "Practice hilling to protect developing tubers; maintain consistent drip irrigation and balanced fertility.",
        "management": "Routine scouting for Colorado potato beetle and foliar blight symptoms.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Raspberry___healthy",
        "crop_name": "Raspberry",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Serrated compound raspberry leaves with pale undersides, healthy primocanes, and vigorous leaf expansion.",
        "prevention": "Prune out spent floricanes after harvest; install trellis support for optimal airflow.",
        "management": "Provide regular organic mulching and monitor for cane blight or spider mites.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Soybean___healthy",
        "crop_name": "Soybean",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Clean trifoliate green soybean leaves without rust pustules, frogeye leaf spots, or bacterial blight streaks.",
        "prevention": "Utilize certified inoculant; plant into well-drained seedbeds; maintain crop rotation with corn.",
        "management": "Conduct periodic scouting during reproductive stages (R1-R5).",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Squash___Powdery_mildew",
        "crop_name": "Squash",
        "disease_name": "Powdery Mildew",
        "healthy": False,
        "pathogen": "Podosphaera xanthii (Fungus)",
        "symptoms": "Circular white talcum-like powdery spots on leaf surfaces and petioles, leading to premature leaf yellowing and senescence.",
        "prevention": "Plant resistant squash varieties; maintain wide row spacing to promote air movement.",
        "management": "Apply potassium bicarbonate, neem oil, or labeled systemic fungicides upon first detection.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Strawberry___Leaf_scorch",
        "crop_name": "Strawberry",
        "disease_name": "Leaf Scorch",
        "healthy": False,
        "pathogen": "Diplocarpon earlianum (Fungus)",
        "symptoms": "Numerous small, irregular purplish-dark brown spots on upper leaf surfaces; leaf margins curl upward and dry out.",
        "prevention": "Plant in well-drained beds with plastic or straw mulch; avoid overhead sprinkler watering.",
        "management": "Remove dead foliage after harvest renovation; apply protective copper or captan fungicides during early flush.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Strawberry___healthy",
        "crop_name": "Strawberry",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Lush trifoliate green strawberry foliage with deep serrations, free of purple spots, chlorosis, or necrotic scorch.",
        "prevention": "Ensure weed control, straw mulching, drip fertigation, and post-harvest bed renovation.",
        "management": "Scout for mites, crown rot, and foliar spot development.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Tomato___Bacterial_spot",
        "crop_name": "Tomato",
        "disease_name": "Bacterial Spot",
        "healthy": False,
        "pathogen": "Xanthomonas perforans (Bacteria)",
        "symptoms": "Small, dark brown to black water-soaked spots on leaves with yellow halos, leading to severe defoliation.",
        "prevention": "Use certified disease-free seed; practice 3-year solanaceous crop rotation; never work in fields when wet.",
        "management": "Apply copper-mancozeb tank mixes protectively; sanitize stakes and pruning shears.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Tomato___Early_blight",
        "crop_name": "Tomato",
        "disease_name": "Early Blight",
        "healthy": False,
        "pathogen": "Alternaria solani (Fungus)",
        "symptoms": "Concentric ring 'target' lesions on older leaves, surrounded by yellow chlorotic halos, progressing upward.",
        "prevention": "Stake plants off the ground, mulch base, and practice drip irrigation to prevent soil splash.",
        "management": "Prune lower infected leaves; apply chlorothalonil, copper, or bio-fungicides every 7-10 days in humid weather.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Tomato___Late_blight",
        "crop_name": "Tomato",
        "disease_name": "Late Blight",
        "healthy": False,
        "pathogen": "Phytophthora infestans (Oomycete)",
        "symptoms": "Large, irregular dark olive-brown water-soaked lesions that spread rapidly; white velvety sporulation on leaf undersides in humidity.",
        "prevention": "Plant resistant cultivars; eliminate volunteer tomato/potato plants; space rows for rapid foliage drying.",
        "management": "Remove and bag infected plants immediately; apply preventive fungicides prior to cool, rainy conditions.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Tomato___Leaf_Mold",
        "crop_name": "Tomato",
        "disease_name": "Leaf Mold",
        "healthy": False,
        "pathogen": "Passalora fulva (Fungus)",
        "symptoms": "Pale greenish-yellow spots with indistinct margins on upper leaf surfaces; velvety olive-brown mold patches on undersides.",
        "prevention": "Ventilate high tunnels and greenhouses; keep relative humidity below 85%; avoid wetting foliage.",
        "management": "Prune lower leaves to improve airflow; apply preventive sulfur or copper sprays if humidity remains elevated.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Tomato___Septoria_leaf_spot",
        "crop_name": "Tomato",
        "disease_name": "Septoria Leaf Spot",
        "healthy": False,
        "pathogen": "Septoria lycopersici (Fungus)",
        "symptoms": "Small circular spots with dark brown margins and gray-tan centers containing tiny black pycnidia.",
        "prevention": "Mulch soil thoroughly around stems; destroy crop debris after harvest; rotate with non-solanaceous crops.",
        "management": "Remove infected lower leaves; apply copper or chlorothalonil protectant sprays.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Tomato___Spider_mites Two-spotted_spider_mite",
        "crop_name": "Tomato",
        "disease_name": "Spider Mites (Two-Spotted Spider Mite)",
        "healthy": False,
        "pathogen": "Tetranychus urticae (Acari / Arachnid)",
        "symptoms": "Fine yellow stippling or bronzing on upper leaf surfaces; fine silk webbing on leaf undersides during hot, dry weather.",
        "prevention": "Avoid dusty conditions; preserve natural predatory mites; avoid excessive nitrogen fertilizer.",
        "management": "Spray insecticidal soap, neem oil, or horticultural oils thoroughly on leaf undersides.",
        "dataset_sources": ["PlantVillage"],
        "field_condition": "Lab"
    },
    {
        "raw_name": "Tomato___Target_Spot",
        "crop_name": "Tomato",
        "disease_name": "Target Spot",
        "healthy": False,
        "pathogen": "Corynespora cassiicola (Fungus)",
        "symptoms": "Small necrotic brown spots with distinct target-like concentric rings and light brown centers, leading to foliar blighting.",
        "prevention": "Stake plants; prune suckers to increase air movement; practice drip irrigation.",
        "management": "Apply registered protectant fungicides before canopy closure; avoid working wet foliage.",
        "dataset_sources": ["PlantVillage"],
        "field_condition": "Lab"
    },
    {
        "raw_name": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
        "crop_name": "Tomato",
        "disease_name": "Tomato Yellow Leaf Curl Virus",
        "healthy": False,
        "pathogen": "TYLCV (Begomovirus, vectored by Bemisia tabaci whiteflies)",
        "symptoms": "Severe upward leaf cupping, reduced leaf size, interveinal chlorosis, stunted plant stature, and flower drop.",
        "prevention": "Install 50-mesh insect netting in greenhouses; use yellow sticky traps; plant TYLCV-resistant hybrids.",
        "management": "Control whitefly vectors using targeted insecticidal soaps or systemic treatments; remove symptomatic plants.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Tomato___Tomato_mosaic_virus",
        "crop_name": "Tomato",
        "disease_name": "Tomato Mosaic Virus",
        "healthy": False,
        "pathogen": "ToMV (Tobamovirus, mechanically transmitted)",
        "symptoms": "Mottled light and dark green mosaic patterns on leaves, leaf distortion, 'fern-leaf' stunting.",
        "prevention": "Wash hands with soap and disinfect pruning tools with 20% non-fat dry milk solution; do not use tobacco near plants.",
        "management": "Rogue out and destroy infected plants immediately; plant resistant varieties with Tm-2/Tm-2^2 resistance.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    },
    {
        "raw_name": "Tomato___healthy",
        "crop_name": "Tomato",
        "disease_name": "Healthy",
        "healthy": True,
        "pathogen": None,
        "symptoms": "Vigorous, dark green compound leaves with crisp margins and clear venation, without lesions or stunting.",
        "prevention": "Provide steady moisture, adequate calcium to prevent blossom end rot, and proper staking/trellising.",
        "management": "Regular scouting for hornworms, aphids, and early foliar spots.",
        "dataset_sources": ["PlantVillage", "PlantDoc"],
        "field_condition": "Lab & In-the-wild"
    }
]

def build_all():
    print("[*] Building Universal Class Registry and Dataset Records...")
    
    # Check image counts in actual PlantVillage dataset on disk
    class_image_counts = {}
    if DATASET_DIR.exists():
        for d in DATASET_DIR.iterdir():
            if d.is_dir():
                cnt = len([f for f in d.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png"]])
                class_image_counts[d.name] = cnt

    canonical_classes = []
    crop_disease_map = {}
    disease_id_counters = {}
    
    for idx, cdef in enumerate(RAW_CLASS_DEFS):
        raw_name = cdef["raw_name"]
        c_name = cdef["crop_name"]
        crop_id = CROP_NAME_TO_ID[c_name]
        
        d_id = disease_id_counters.get(c_name, 0)
        disease_id_counters[c_name] = d_id + 1
        
        img_count = class_image_counts.get(raw_name, 0)
        
        entry = {
            "class_index": idx,
            "crop_id": crop_id,
            "crop_name": c_name,
            "disease_id": d_id,
            "disease_name": cdef["disease_name"],
            "healthy": cdef["healthy"],
            "raw_class_name": raw_name,
            "canonical_name": f"{c_name}___{cdef['disease_name']}".replace(" ", "_"),
            "pathogen": cdef["pathogen"],
            "symptoms": cdef["symptoms"],
            "prevention": cdef["prevention"],
            "management": cdef["management"],
            "image_count": img_count,
            "field_condition": cdef["field_condition"],
            "dataset_sources": cdef["dataset_sources"],
            "status": "Healthy" if cdef["healthy"] else "Diseased"
        }
        canonical_classes.append(entry)
        crop_disease_map.setdefault(c_name, []).append(entry["disease_name"])

    # 1. Write class_registry.json
    class_reg_path = OUTPUT_DIR / "class_registry.json"
    with open(class_reg_path, "w", encoding="utf-8") as f:
        json.dump({
            "registry_version": "2.0.0",
            "taxonomy": "Universal Agricultural Crop-Disease Ontology",
            "total_supported_crops": len(CROPS),
            "total_supported_classes": len(canonical_classes),
            "crops": CROPS,
            "classes": canonical_classes
        }, f, indent=2)
    print(f"[OK] Saved {len(canonical_classes)} canonical classes to {class_reg_path}")

    # Also copy to dataset/class_registry.json and frontend/src/utils/class_registry.json
    frontend_dir = ROOT_DIR / "frontend" / "src" / "utils"
    frontend_dir.mkdir(parents=True, exist_ok=True)
    with open(ROOT_DIR / "dataset" / "class_registry.json", "w", encoding="utf-8") as f:
        json.dump({
            "registry_version": "2.0.0",
            "total_supported_crops": len(CROPS),
            "total_supported_classes": len(canonical_classes),
            "crops": CROPS,
            "classes": canonical_classes
        }, f, indent=2)
    with open(frontend_dir / "class_registry.json", "w", encoding="utf-8") as f:
        json.dump({
            "registry_version": "2.0.0",
            "total_supported_crops": len(CROPS),
            "total_supported_classes": len(canonical_classes),
            "crops": CROPS,
            "classes": canonical_classes
        }, f, indent=2)

    # 2. Write crop_classes.json
    crop_classes_path = OUTPUT_DIR / "crop_classes.json"
    crop_classes_data = {
        "crop_names": [c["name"] for c in CROPS],
        "crop_to_id": CROP_NAME_TO_ID,
        "id_to_crop": {c["id"]: c["name"] for c in CROPS},
        "crops": CROPS
    }
    with open(crop_classes_path, "w", encoding="utf-8") as f:
        json.dump(crop_classes_data, f, indent=2)
    print(f"[OK] Saved crop classes to {crop_classes_path}")

    # 3. Write disease_classes.json
    disease_classes_path = OUTPUT_DIR / "disease_classes.json"
    with open(disease_classes_path, "w", encoding="utf-8") as f:
        json.dump({
            "crops": crop_disease_map,
            "raw_classes": [c["raw_name"] for c in RAW_CLASS_DEFS],
            "total_classes": len(canonical_classes)
        }, f, indent=2)
    print(f"[OK] Saved disease classes to {disease_classes_path}")

    # 4. Write dataset_registry.json
    dataset_records = [
        {
            "dataset_name": "PlantVillage",
            "source": "Crowdsourced & Penn State University (spMohanty/PlantVillage-Dataset)",
            "license": "CC0 1.0 Universal (Public Domain)",
            "source_url": "https://github.com/spMohanty/PlantVillage-Dataset",
            "field_lab_condition": "Controlled Laboratory (standardized background)",
            "crops_count": 14,
            "classes_count": 38,
            "total_images": sum(class_image_counts.values()),
            "usage": "Training & Stratified Validation",
            "classes_covered": [c["raw_name"] for c in RAW_CLASS_DEFS]
        },
        {
            "dataset_name": "PlantDoc",
            "source": "ACM CoDS-COMAD 2020 (ai-agriculture-circuits-and-systems / pratikkayal/PlantDoc-Dataset)",
            "license": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
            "source_url": "https://github.com/pratikkayal/PlantDoc-Dataset",
            "field_lab_condition": "In-the-wild real agricultural field conditions (outdoor natural daylight, shadows, complex backgrounds)",
            "crops_count": 13,
            "classes_count": 27,
            "total_images": 2585,
            "usage": "Independent Field Test Benchmark & Field Robustness Validation",
            "classes_covered": [
                "Apple Scab Leaf", "Apple leaf", "Apple rust leaf", "Bell_pepper leaf", "Bell_pepper leaf spot",
                "Blueberry leaf", "Cherry leaf", "Corn Gray leaf spot", "Corn leaf blight", "Corn rust leaf",
                "Peach leaf", "Potato leaf early blight", "Potato leaf late blight", "Raspberry leaf",
                "Soyabean leaf", "Squash Powdery mildew leaf", "Strawberry leaf", "Tomato Early blight leaf",
                "Tomato Septoria leaf spot", "Tomato leaf", "Tomato leaf bacterial spot", "Tomato leaf late blight",
                "Tomato leaf mosaic virus", "Tomato leaf yellow virus", "Tomato mold leaf", "grape leaf", "grape leaf black rot"
            ]
        },
        {
            "dataset_name": "MVPDR / PlantWild",
            "source": "ACM Multimedia 2024 (tqwei05/MVPDR)",
            "license": "Academic Research Use",
            "source_url": "https://github.com/tqwei05/MVPDR",
            "field_lab_condition": "Multimodal in-the-wild benchmark across wild agricultural environments",
            "crops_count": 14,
            "usage": "Cross-domain Benchmark & OOD Calibration Reference"
        }
    ]
    dataset_reg_path = OUTPUT_DIR / "dataset_registry.json"
    with open(dataset_reg_path, "w", encoding="utf-8") as f:
        json.dump({
            "datasets": dataset_records,
            "total_datasets": len(dataset_records),
            "summary": "AI-powered plant leaf disease detection across supported crop and disease classes."
        }, f, indent=2)
    print(f"[OK] Saved dataset registry to {dataset_reg_path}")

if __name__ == "__main__":
    build_all()
