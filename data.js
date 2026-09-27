'use strict';
/* ==========================================================================
   DATA — standards register, BOQ library, risk library, checklists,
   authority matrix, drawing & deliverable templates, sample project
   All reference entries: clauses are NOT cited unless confirmed.
   ========================================================================== */
const CVR = 'CLAUSE VERIFICATION REQUIRED';
const STD_STATUS = ['CURRENT','VERIFY','SUPERSEDED','REFERENCE ONLY'];

/* s = [id, group, authority, title, number, edition, revision, effective, url, status, scope] */
const STD_ROWS = [
 ['MSMA2','JPS / MSMA','Jabatan Pengairan dan Saliran (JPS / DID)','Urban Stormwater Management Manual for Malaysia (MSMA)','MSMA','2nd Edition','—','2012','https://www.water.gov.my','VERIFY','Primary stormwater design basis: hydrology, IDF, runoff, conveyance, detention, OSD, water quality, ESC'],
 ['HP1','JPS / MSMA','JPS / DID','Hydrological Procedure No. 1 — Estimation of Design Rainstorm in Peninsular Malaysia','HP 1','Latest revision — VERIFY','—','—','https://www.water.gov.my','VERIFY','Design rainstorm / IDF station coefficients (official source for IDF input)'],
 ['JPS_ESC','JPS / MSMA','JPS / DID','Guideline for Erosion and Sediment Control in Malaysia','—','VERIFY','—','—','https://www.water.gov.my','VERIFY','ESCP planning and BMP sizing'],
 ['JPS_RR','JPS / MSMA','JPS / DID','Guideline on river reserve / development near rivers','—','VERIFY','—','—','https://www.water.gov.my','VERIFY','River reserve widths, outfall and crossing approvals'],
 ['JPS_FLOOD','JPS / MSMA','JPS / DID (State office)','Flood level / flood map data request (historical & design flood levels)','—','Project-specific','—','—','','VERIFY','Design flood level for platform RL — AUTHORITY DATA'],
 ['ATJ585','JKR','Jabatan Kerja Raya (JKR)','Arahan Teknik (Jalan) 5/85 — Manual on Pavement Design','ATJ 5/85','Pindaan 2013 — VERIFY','2013','—','https://www.jkr.gov.my','VERIFY','Flexible pavement design, traffic & subgrade categories'],
 ['ATJ886','JKR','JKR','Arahan Teknik (Jalan) 8/86 — A Guide on Geometric Design of Roads','ATJ 8/86','Pindaan 2015 — VERIFY','—','—','https://www.jkr.gov.my','VERIFY','Road geometry, gradients, widths, curve widening'],
 ['JKR_SPJ','JKR','JKR','Standard Specification for Road Works','JKR/SPJ','Latest — VERIFY','—','—','https://www.jkr.gov.my','VERIFY','Earthworks, pavement materials, drainage works specification'],
 ['JKR_SSBW','JKR','JKR','Standard Specifications for Building Works (incl. piling, concrete)','—','Latest — VERIFY','—','—','https://www.jkr.gov.my','VERIFY','Concrete, reinforcement, piling, testing requirements'],
 ['JKR_SLOPE','JKR','JKR (Cawangan Kejuruteraan Cerun)','Guidelines for Slope Design','—','VERIFY','—','—','https://www.jkr.gov.my','VERIFY','Cut/fill slope design, factors of safety, drainage'],
 ['JKR_RDRAIN','JKR','JKR','Road drainage design guideline (Arahan Teknik series)','VERIFY','VERIFY','—','—','https://www.jkr.gov.my','VERIFY','Road-side drainage, culverts under roads'],
 ['PBT_REQ','PBT','Pihak Berkuasa Tempatan (project PBT)','Local council earthwork, drainage, road, building & submission requirements','Project-specific','—','—','—','','VERIFY','Earthwork (Borang/permit), plan approval, fees, standard drawings — AUTHORITY CONFIRMATION REQUIRED'],
 ['SDBL','PBT','PBT / State','Street, Drainage and Building Act 1974 (Act 133) and state by-laws','Act 133','—','—','1974','','VERIFY','Legal basis for PBT approvals: earthworks by-laws, building plans'],
 ['UBBL','PBT','State / PBT','Uniform Building By-Laws 1984 (as adopted by the State)','UBBL 1984','As amended — VERIFY','—','1984','','VERIFY','Buildings (control room, O&M): structural, fire requirements'],
 ['PLAN_GP','PLANMalaysia','PLANMalaysia','Planning guideline applicable to solar farm / utility development','VERIFY','VERIFY','—','—','https://www.planmalaysia.gov.my','VERIFY','Land use, setbacks, buffer, planning permission (KM)'],
 ['TCPA','PLANMalaysia','Federal / State','Town and Country Planning Act 1976 (Act 172)','Act 172','As amended','—','1976','','VERIFY','Planning permission requirement'],
 ['BOMBA_BESS','BOMBA','Jabatan Bomba dan Penyelamat Malaysia','BOMBA requirements for BESS / energy storage installations','VERIFY','VERIFY','—','—','https://www.bomba.gov.my','VERIFY','Fire access, hydrant, separation, fire-water — AUTHORITY CONFIRMATION REQUIRED'],
 ['FSA','BOMBA','Federal','Fire Services Act 1988 (Act 341)','Act 341','As amended','—','1988','','VERIFY','Fire certificate / designated premises'],
 ['OSHA','DOSH / JKKP','DOSH (JKKP)','Occupational Safety and Health Act 1994 (Act 514)','Act 514','As amended (2022 amendment) — VERIFY','—','1994','https://www.dosh.gov.my','VERIFY','General duties, construction safety'],
 ['FMA','DOSH / JKKP','DOSH (JKKP)','Factories and Machinery Act 1967 (Act 139)','Act 139','As amended — VERIFY status','—','1967','https://www.dosh.gov.my','VERIFY','Cranes, lifting, machinery registration'],
 ['BOWEC','DOSH / JKKP','DOSH (JKKP)','Factories and Machinery (Building Operations and Works of Engineering Construction) (Safety) Regulations 1986','BOWEC 1986','—','—','1986','https://www.dosh.gov.my','VERIFY','Temporary works, excavation, piling, lifting safety'],
 ['CIDB520','CIDB','CIDB Malaysia','Lembaga Pembangunan Industri Pembinaan Malaysia Act 1994 (Act 520)','Act 520','As amended','—','1994','https://www.cidb.gov.my','VERIFY','Contractor registration, levy, construction standards'],
 ['CIDB_CIS','CIDB','CIDB Malaysia','Construction Industry Standards (CIS) applicable to civil works','VERIFY','VERIFY','—','—','https://www.cidb.gov.my','VERIFY','Quality / safety standards referenced by contract'],
 ['EQA','DOE / JAS','Jabatan Alam Sekitar (DOE)','Environmental Quality Act 1974 (Act 127)','Act 127','As amended','—','1974','https://www.doe.gov.my','VERIFY','Environmental approvals, discharge'],
 ['EIA2015','DOE / JAS','DOE','Environmental Quality (Prescribed Activities)(Environmental Impact Assessment) Order 2015','P.U.(A) — VERIFY','2015','—','2015','https://www.doe.gov.my','VERIFY','EIA / prescribed activity screening (land clearing, earthworks thresholds) — VERIFY applicability'],
 ['LDP2M2','DOE / JAS','DOE','Guidance document on Land Disturbing Pollution Prevention and Mitigation Measures (LD-P2M2)','—','VERIFY','—','—','https://www.doe.gov.my','VERIFY','ESCP / LD-P2M2 submission and BMP performance'],
 ['ESA','Suruhanjaya Tenaga','Suruhanjaya Tenaga (ST)','Electricity Supply Act 1990 (Act 447)','Act 447','As amended','—','1990','https://www.st.gov.my','VERIFY','Licensing, installation requirements'],
 ['ST_GRID','Suruhanjaya Tenaga','ST','Malaysian Grid Code (Peninsular Malaysia)','—','Latest — VERIFY','—','—','https://www.st.gov.my','VERIFY','Grid connection (civil interface: substation / POI)'],
 ['ST_LSS','Suruhanjaya Tenaga','ST','LSS / RE programme Request for Proposal & guidelines (project-specific)','Project-specific','—','—','—','https://www.st.gov.my','VERIFY','Programme requirements, COD, capacity definitions'],
 ['TNB_TG','TNB / SESB / SEB','Tenaga Nasional Berhad','TNB technical guidebook / requirements for connection of generation & substation civil works','VERIFY','VERIFY','—','—','https://www.tnb.com.my','VERIFY','Substation civil, cable routes, access to TNB assets'],
 ['SESB','TNB / SESB / SEB','Sabah Electricity Sdn Bhd','SESB connection requirements (Sabah projects only)','VERIFY','VERIFY','—','—','https://www.sesb.com.my','REFERENCE ONLY','Applicable only for Sabah'],
 ['SEB','TNB / SESB / SEB','Sarawak Energy Berhad','Sarawak Energy connection requirements (Sarawak projects only)','VERIFY','VERIFY','—','—','https://www.sarawakenergy.com','REFERENCE ONLY','Applicable only for Sarawak'],
 ['EN1990','Malaysian-adopted Eurocodes','Standards Malaysia / DSM','MS EN 1990 Basis of structural design + Malaysian National Annex','MS EN 1990','VERIFY year / NA','—','—','https://www.jsm.gov.my','VERIFY','Load combinations, partial factors (NA values to be verified)'],
 ['EN1991_1','Malaysian-adopted Eurocodes','Standards Malaysia','MS EN 1991-1-1 Actions — densities, self-weight, imposed loads + NA','MS EN 1991-1-1','VERIFY','—','—','https://www.jsm.gov.my','VERIFY','Permanent and imposed actions'],
 ['EN1991_4','Malaysian-adopted Eurocodes','Standards Malaysia','MS EN 1991-1-4 Actions — wind actions + Malaysian National Annex','MS EN 1991-1-4','VERIFY','—','—','https://www.jsm.gov.my','VERIFY','Basic wind velocity (NA), terrain, peak velocity pressure'],
 ['EN1992','Malaysian-adopted Eurocodes','Standards Malaysia','MS EN 1992-1-1 Design of concrete structures + NA','MS EN 1992-1-1','VERIFY','—','—','https://www.jsm.gov.my','VERIFY','RC flexure, shear, punching, detailing'],
 ['EN1993','Malaysian-adopted Eurocodes','Standards Malaysia','MS EN 1993-1-1 Design of steel structures + NA','MS EN 1993-1-1','VERIFY','—','—','https://www.jsm.gov.my','VERIFY','Steel members, buckling, combined actions'],
 ['EN1997','Malaysian-adopted Eurocodes','Standards Malaysia','MS EN 1997-1 Geotechnical design + NA','MS EN 1997-1','VERIFY','—','—','https://www.jsm.gov.my','VERIFY','Bearing resistance (informative annex), design approaches, piles'],
 ['EN1998','Malaysian-adopted Eurocodes','Standards Malaysia','MS EN 1998-1 Design of structures for earthquake resistance + Malaysian NA','MS EN 1998-1','VERIFY','—','—','https://www.jsm.gov.my','VERIFY','Seismic screening where required by NA / client'],
 ['MS1553','Standards Malaysia','Standards Malaysia','MS 1553 Code of practice on wind loading for building structure','MS 1553:2002','2002','—','2002','https://www.jsm.gov.my','VERIFY','Legacy wind code — confirm whether superseded by MS EN 1991-1-4 for project'],
 ['CLIENT_ER','Client Requirements','Client / Developer','Employer\'s Requirements / Owner\'s Technical Specification (C&S)','Project-specific','—','—','—','','VERIFY','Governing client criteria — may exceed code minimum'],
 ['CLIENT_GEO','Client Requirements','Client / Developer','Client geotechnical & pile testing specification','Project-specific','—','—','—','','VERIFY','Pile test frequency, acceptance criteria'],
 ['NFPA855','International Best Practice','NFPA','NFPA 855 Standard for the Installation of Stationary Energy Storage Systems','NFPA 855','Latest — VERIFY','—','—','https://www.nfpa.org','REFERENCE ONLY','BESS spacing, fire access (reference only unless adopted by BOMBA/client)'],
 ['FM533','International Best Practice','FM Global','FM Global Property Loss Prevention Data Sheet 5-33 (Lithium-ion BESS)','DS 5-33','Latest — VERIFY','—','—','https://www.fmglobal.com','REFERENCE ONLY','BESS separation, containment guidance'],
 ['IEEE980','International Best Practice','IEEE','IEEE 980 Guide for Containment and Control of Oil Spills in Substations','IEEE 980','Latest — VERIFY','—','—','https://standards.ieee.org','REFERENCE ONLY','Transformer oil containment sizing'],
 ['CIRIA736','International Best Practice','CIRIA','CIRIA C736 Containment systems for the prevention of pollution','C736','2014','—','2014','https://www.ciria.org','REFERENCE ONLY','Secondary / tertiary containment (fire-water) sizing'],
 ['BRE470','International Best Practice','BRE','BR 470 Working platforms for tracked plant','BR 470','2004','—','2004','https://www.bre.co.uk','REFERENCE ONLY','Crane / piling rig working platform design'],
 ['HDS5','International Best Practice','US FHWA','Hydraulic Design of Highway Culverts (HDS-5)','FHWA-HIF-12-026','3rd Edition','—','2012','https://www.fhwa.dot.gov','REFERENCE ONLY','Culvert inlet / outlet control'],
 ['HEC14','International Best Practice','US FHWA','Hydraulic Design of Energy Dissipators for Culverts and Channels (HEC-14)','FHWA-NHI-06-086','3rd Edition','—','2006','https://www.fhwa.dot.gov','REFERENCE ONLY','Riprap aprons, outlet protection'],
 ['USACE_CBR','International Best Practice','US Army Corps of Engineers','CBR design method for unsurfaced / aggregate-surfaced roads','TM 5-822-12 / EM series — VERIFY','—','—','—','','REFERENCE ONLY','Granular road thickness screening'],
 ['BS8004','International Best Practice','BSI','BS 8004 Code of practice for foundations','BS 8004:2015','2015','—','2015','https://www.bsigroup.com','REFERENCE ONLY','Foundation practice (reference)'],
 ['BS6031','International Best Practice','BSI','BS 6031 Code of practice for earthworks','BS 6031:2009','2009','—','2009','https://www.bsigroup.com','REFERENCE ONLY','Earthworks practice, bulking / shrinkage'],
 ['LIT_MEY','International Best Practice','Literature','Meyerhof (1976) Bearing capacity and settlement of pile foundations, ASCE JGED','—','—','—','1976','','REFERENCE ONLY','SPT-based pile shaft/base resistance'],
 ['LIT_BROMS','International Best Practice','Literature','Broms (1964) Lateral resistance of piles in cohesive / cohesionless soils, ASCE JSMFD','—','—','—','1964','','REFERENCE ONLY','Lateral pile capacity screening'],
 ['LIT_HOYT','International Best Practice','Literature','Hoyt & Clemence (1989) Uplift capacity of helical anchors in soil','—','—','—','1989','','REFERENCE ONLY','Torque-capacity correlation (vendor-specific Kt)'],
 ['LIT_BOWLES','International Best Practice','Literature','Bowles — Foundation Analysis and Design','—','5th Ed.','—','1996','','REFERENCE ONLY','Bearing capacity factors, elastic settlement influence factors'],
 ['LIT_TOML','International Best Practice','Literature','Tomlinson & Woodward — Pile Design and Construction Practice','—','Latest','—','—','','REFERENCE ONLY','Adhesion factor α, pile practice'],
 ['LIT_STROUD','International Best Practice','Literature','Stroud (1974) SPT correlations (Cu ≈ f1·N)','—','—','—','1974','','REFERENCE ONLY','Interpreted undrained strength from SPT'],
 ['LIT_HAT','International Best Practice','Literature','Hatanaka & Uchida (1996) φ′ from SPT','—','—','—','1996','','REFERENCE ONLY','Interpreted friction angle from SPT'],
 ['SPAN_UTG','Client Requirements','SPAN / State water operator','Water supply technical guidelines (state water operator)','VERIFY','VERIFY','—','—','https://www.span.gov.my','VERIFY','Water supply connection, tank, reticulation'],
 ['MSIG','Client Requirements','SPAN / IWK','Malaysian Sewerage Industry Guidelines','Vol. — VERIFY','VERIFY','—','—','https://www.span.gov.my','VERIFY','Population equivalent, septic / package plant'],
];
const STANDARDS_DEFAULT = STD_ROWS.map(r => ({id:r[0], group:r[1], auth:r[2], title:r[3], number:r[4], edition:r[5], rev:r[6], date:r[7], url:r[8], status:r[9], scope:r[10], clause:CVR, verified:'', verifiedBy:''}));
const STD_GROUPS = ['JPS / MSMA','JKR','PBT','PLANMalaysia','BOMBA','DOSH / JKKP','CIDB','DOE / JAS','Suruhanjaya Tenaga','TNB / SESB / SEB','Standards Malaysia','Malaysian-adopted Eurocodes','Client Requirements','International Best Practice'];

/* MSMA topic mapping — MSMA treated as a system of requirements, not one reference */
const MSMA_MAP = [
 ['Hydrology — design storm & ARI selection','MSMA2','Design ARI for minor / major systems by land use','Calc: Rainfall/IDF, Rational','Design criteria table (Hydrology)'],
 ['Rainfall — IDF relationship','MSMA2 / HP1','Station-based IDF coefficients (λ, κ, θ, η); d in hours','Calc: Rainfall/IDF','Official station coefficients required — JPS DATA REQUIRED'],
 ['ARI — minor / major','MSMA2','Minor system ARI; major system ARI; detention ARI','Design criteria','Confirm with JPS / PBT'],
 ['Runoff — Rational Method','MSMA2','Q = C·i·A/360 (A in ha, i in mm/hr); C by land use & ARI','Calc: Catchment, Rational','Applicability limit on catchment size — '+CVR],
 ['Runoff — time of concentration','MSMA2','Overland flow time + channel/drain flow time','Calc: Tc','Overland roughness n* table — '+CVR],
 ['Drainage — open drains & swales','MSMA2','Manning conveyance, freeboard, velocity limits, lining','Calc: Manning, Drain sizing, Velocity','Velocity limits — '+CVR],
 ['Major / minor system','MSMA2','Minor system conveys minor ARI; major flow path safely conveyed','Drainage module','Overland flow path to be shown on drawings'],
 ['Detention (quantity control)','MSMA2','Post-development peak ≤ pre-development peak (no net increase)','Calc: Detention pond','Governing criterion — ENGINEER CONFIRMATION'],
 ['Retention / infiltration','MSMA2','Infiltration feasibility (soil permeability, groundwater separation)','Calc: Retention/Infiltration','Site-specific percolation tests — SI REQUIRED'],
 ['On-Site Detention (OSD)','MSMA2','OSD storage & PSD for lots / compounds','Calc: OSD','PSD/SSR tables — '+CVR],
 ['Water quality','MSMA2','Pollutant removal / BMP selection (swales, sediment forebay, wetlands)','Detention / Drainage modules','Water quality design criteria — '+CVR],
 ['Erosion control','MSMA2 / JPS_ESC / LDP2M2','Erosion control BMPs, turfing, slope protection','Calc: ESCP, Scour','LD-P2M2 / ESCP approval — AUTHORITY CONFIRMATION REQUIRED'],
 ['Sediment control','MSMA2 / JPS_ESC','Sediment basin, silt trap, check dams, silt fence sizing','Calc: ESCP','Design storm for ESC — '+CVR],
 ['Source control','MSMA2','Rainwater harvesting / source control where required','Water supply / Drainage','Applicability to solar farm — ENGINEER CONFIRMATION'],
 ['Operation & maintenance','MSMA2','O&M of ponds, drains, BMPs; access for maintenance','Detention / Drainage','O&M manual deliverable'],
];

/* ---------- BOQ library (DEMONSTRATION RATES, RM) ---------- */
/* [key, bill, description, unit, rate, sensGroup, scope] */
const BOQ_ROWS = [
 ['SURV_TOPO','1 Preliminaries, Survey & SI','Topographical & detail survey incl. DTM (GDM2000)','ha',350,'other','survey'],
 ['SI_BH','1 Preliminaries, Survey & SI','Site investigation — rotary wash boring with SPT, to 30 m or refusal','no',9500,'other','si'],
 ['SI_LAB','1 Preliminaries, Survey & SI','Laboratory testing incl. chemical (pH, SO₄, Cl), resistivity, CBR','lot',65000,'other','si'],
 ['EW_CLEAR','2 Earthworks','Site clearing, grubbing & disposal of vegetation','ha',3500,'fill','earthworks'],
 ['EW_STRIP','2 Earthworks','Strip topsoil & stockpile','m³',6.5,'fill','earthworks'],
 ['EW_CUT','2 Earthworks','Excavation (cut) in common material','m³',8.0,'fill','earthworks'],
 ['EW_FILL','2 Earthworks','Fill & compact site-won suitable material to 95% MDD','m³',7.0,'fill','earthworks'],
 ['EW_IMPORT','2 Earthworks','Imported suitable fill, placed & compacted','m³',28.0,'fill','earthworks'],
 ['EW_UNSUIT','2 Earthworks','Remove unsuitable material','m³',12.0,'fill','earthworks'],
 ['EW_DISP','2 Earthworks','Disposal of surplus / unsuitable material off-site','m³',10.0,'fill','earthworks'],
 ['EW_HAUL','2 Earthworks','Overhaul beyond free-haul distance','m³·km',1.2,'fill','earthworks'],
 ['EW_TURF','2 Earthworks','Close turfing / hydroseeding to slopes & disturbed areas','m²',3.5,'other','earthworks'],
 ['RD_SUBGRADE','3 Roads & Hardstanding','Subgrade preparation & proof rolling','m²',2.5,'road','roads'],
 ['RD_GEOTEX','3 Roads & Hardstanding','Geotextile separator','m²',6.0,'road','roads'],
 ['RD_SUBBASE','3 Roads & Hardstanding','Granular sub-base','m³',75,'road','roads'],
 ['RD_BASE','3 Roads & Hardstanding','Crusher-run road base','m³',90,'road','roads'],
 ['RD_AC','3 Roads & Hardstanding','Bituminous surfacing (main access, where specified)','m²',38,'road','roads'],
 ['RD_HARD','3 Roads & Hardstanding','Crane / laydown hardstanding (granular working platform)','m³',85,'road','roads'],
 ['DR_EARTH','4 Drainage','Earth drain (trapezoidal), turfed','m',35,'drain','drainage'],
 ['DR_CONC','4 Drainage','Concrete-lined drain (trapezoidal / U)','m',320,'drain','drainage'],
 ['DR_SWALE','4 Drainage','Grass swale','m',45,'drain','drainage'],
 ['DR_PIPE','4 Drainage','RC pipe culvert incl. bedding','m',850,'drain','culverts'],
 ['DR_BOX','4 Drainage','Precast box culvert incl. base','m',4500,'drain','culverts'],
 ['DR_HEADWALL','4 Drainage','Culvert headwall / wingwall','no',6500,'drain','culverts'],
 ['DR_RIPRAP','4 Drainage','Rock riprap / outlet apron incl. geotextile','m³',180,'drain','drainage'],
 ['DR_POND_EXC','4 Drainage','Detention pond excavation & shaping','m³',9,'drain','detention'],
 ['DR_OUTLET','4 Drainage','Detention pond outlet structure (orifice / riser)','no',45000,'drain','detention'],
 ['DR_SPILL','4 Drainage','Emergency spillway incl. protection','no',60000,'drain','detention'],
 ['ES_FENCE','5 ESCP','Silt fence','m',12,'other','escp'],
 ['ES_BASIN','5 ESCP','Sediment basin (excavation, outlet, dewatering)','m³',14,'other','escp'],
 ['ES_TRAP','5 ESCP','Silt trap','no',3500,'other','escp'],
 ['ES_CHECK','5 ESCP','Check dam (rock / sandbag)','no',1500,'other','escp'],
 ['ES_TDRAIN','5 ESCP','Temporary earth drain / diversion','m',25,'other','escp'],
 ['PL_PV','6 Foundations','PV mounting pile — supply & install (galvanised steel section)','no',320,'pile','foundations'],
 ['PL_PREDRILL','6 Foundations','Pre-drilling for PV piles (provisional)','no',140,'pile','foundations'],
 ['PL_EQUIP','6 Foundations','Equipment piles (spun / steel) — supply & drive','m',180,'pile','foundations'],
 ['PL_TEST_C','6 Foundations','Pile load test — compression','no',9000,'pile','piletest'],
 ['PL_TEST_T','6 Foundations','Pile load test — uplift (tension)','no',7000,'pile','piletest'],
 ['PL_TEST_L','6 Foundations','Pile load test — lateral','no',7000,'pile','piletest'],
 ['EX_FDN','6 Foundations','Excavation for foundations incl. backfill','m³',25,'concrete','foundations'],
 ['CN_LEAN','6 Foundations','Lean concrete blinding Grade 15','m³',280,'concrete','foundations'],
 ['CN_G30','6 Foundations','Structural concrete Grade C30/37','m³',430,'concrete','foundations'],
 ['RF_Y','6 Foundations','High-yield reinforcement (fyk 500)','t',4800,'rebar','foundations'],
 ['FW_FORM','6 Foundations','Formwork to foundations / walls','m²',55,'concrete','foundations'],
 ['CT_EXC','7 Cable Trench & Services','Cable trench excavation','m³',18,'other','cable'],
 ['CT_SAND','7 Cable Trench & Services','Sand bedding & surround','m³',85,'other','cable'],
 ['CT_BACK','7 Cable Trench & Services','Selected backfill & compaction','m³',12,'other','cable'],
 ['CT_SLAB','7 Cable Trench & Services','Cable protection slab / tile','m',28,'other','cable'],
 ['CT_TAPE','7 Cable Trench & Services','Warning tape','m',1.5,'other','cable'],
 ['CT_DUCT','7 Cable Trench & Services','HDPE duct at crossings','m',35,'other','cable'],
 ['FN_FENCE','8 Ancillary','Perimeter security fence incl. posts & footings','m',145,'other','ancillary'],
 ['FN_GATE','8 Ancillary','Double-leaf vehicular gate incl. foundations','no',15000,'other','ancillary'],
 ['SC_POLE','8 Ancillary','CCTV / lighting pole foundation','no',2800,'concrete','ancillary'],
 ['WS_TANK','8 Ancillary','Water storage tank incl. stand/foundation','no',35000,'other','ancillary'],
 ['WS_PIPE','8 Ancillary','Water supply pipe incl. trenching','m',60,'other','ancillary'],
 ['SW_SEPTIC','8 Ancillary','Septic tank / small package sewage system','no',45000,'other','ancillary'],
 ['FW_HARD','8 Ancillary','Fire appliance access / hardstanding (granular)','m²',120,'road','fireaccess'],
 ['FW_TANK_FDN','8 Ancillary','Fire-water tank foundation ring / raft (see concrete)','no',20000,'concrete','fireaccess'],
 ['SS_GRAVEL','9 Substation Civil','Substation yard gravel surfacing 100 mm','m²',18,'other','substation'],
 ['TX_OWS','9 Substation Civil','Oil-water separator for transformer bund drainage','no',55000,'other','substation'],
 ['BS_GRAVEL','10 BESS Civil','BESS yard gravel / crushed stone surfacing','m²',18,'other','bess'],
 ['BS_CONT','10 BESS Civil','BESS / transformer containment sump & bund (see concrete)','no',30000,'concrete','containment'],
 ['BS_OWS','10 BESS Civil','Oil-water separator / interceptor','no',60000,'other','containment'],
 ['BS_KERB','10 BESS Civil','Platform kerb / edge restraint','m',65,'concrete','bess'],
 ['TW_OFFICE','11 Temporary Works','Site office, welfare & temporary facilities','month',25000,'other','temporary'],
 ['TW_LAYDOWN','11 Temporary Works','Temporary laydown area (granular)','m²',12,'road','temporary'],
 ['AU_SUB','12 Authority, Testing & Records','Authority submissions & approvals (C&S)','lot',180000,'other','authority'],
 ['AS_BUILT','12 Authority, Testing & Records','As-built survey & drawings','ha',250,'other','asbuilt'],
 ['TEST_MAT','12 Authority, Testing & Records','Materials testing (compaction, concrete cubes, CBR)','lot',90000,'other','testing'],
];
const BOQ_LIB = {}; BOQ_ROWS.forEach(r => BOQ_LIB[r[0]] = {key:r[0], bill:r[1], desc:r[2], unit:r[3], rate:r[4], grp:r[5], scope:r[6]});
const SENS_GROUPS = {fill:'Fill / earthworks rate', concrete:'Concrete rate', rebar:'Reinforcement rate', pile:'Pile rate', road:'Road rate', drain:'Drain rate'};

/* scope gap engine mapping */
const SCOPE_AREAS = [
 ['survey','Topographical survey',['SURV_TOPO']],
 ['si','Site investigation',['SI_BH','SI_LAB']],
 ['earthworks','Earthworks',['EW_CLEAR','EW_STRIP','EW_CUT','EW_FILL','EW_IMPORT']],
 ['roads','Roads',['RD_SUBBASE','RD_BASE','RD_SUBGRADE']],
 ['drainage','Drainage',['DR_EARTH','DR_CONC','DR_SWALE']],
 ['detention','Detention',['DR_POND_EXC','DR_OUTLET','DR_SPILL']],
 ['escp','ESCP',['ES_FENCE','ES_BASIN','ES_TRAP','ES_CHECK']],
 ['foundations','Foundations',['PL_PV','CN_G30','RF_Y']],
 ['piletest','Pile testing',['PL_TEST_C','PL_TEST_T','PL_TEST_L']],
 ['culverts','Culverts',['DR_PIPE','DR_BOX','DR_HEADWALL']],
 ['bess','BESS civil',['BS_GRAVEL','BS_KERB'], 'B'],
 ['containment','Containment',['BS_CONT','BS_OWS'], 'B'],
 ['fireaccess','Fire access',['FW_HARD']],
 ['cable','Cable trench',['CT_EXC','CT_SAND','CT_BACK']],
 ['authority','Authority submissions',['AU_SUB']],
 ['asbuilt','As-built',['AS_BUILT']],
 ['testing','Testing',['TEST_MAT']],
];

/* ---------- risk library: Technical issue → Construction → Cost → Programme ---------- */
/* each: id, module, title, cond(R,P)->bool|string, chain[4], L, C, mitigation, owner, types */
const RISK_LIB = [
 {id:'RK-GEO-01', mod:'m27', t:'Hard layer / rock at shallow depth', cond:(R)=>R.GEO && R.GEO.res.hardDepth != null && R.PVP && R.GEO.res.hardDepth < R.PVP.I.L + 0.5,
  chain:['Hard stratum (SPT N ≥ 50) encountered above PV pile toe level','Pile refusal during driving; piles not reaching design embedment','Pre-drilling of a proportion of piles (provisional item) and possible pile re-design','Reduced piling productivity; programme extension to PV installation'], L:4, C:4, mit:'Carry out pile driving trials and pre-construction pull-out tests; include pre-drilling provisional quantity; verify SI coverage density.', owner:'EPC / Piling contractor'},
 {id:'RK-GEO-02', mod:'m10', t:'Soft compressible clay near surface', cond:(R)=>R.GEO && R.GEO.res.softTop,
  chain:['Very soft to soft clay (Cu < 25 kPa) within upper 3 m','Low lateral pile resistance; settlement of platforms and roads','Longer / larger piles, ground improvement or surcharge for platforms','Additional design & construction time; settlement monitoring period'], L:3, C:4, mit:'Additional SI with CPTu / vane; consolidation testing; settlement analysis before platform design is frozen.', owner:'C&S consultant'},
 {id:'RK-GEO-03', mod:'m10', t:'Aggressive soil conditions (corrosion of steel piles)', cond:(R)=>R.GEO && R.GEO.res.corrosive,
  chain:['Low pH / low resistivity / high chloride measured in soil','Accelerated corrosion of galvanised steel piles','Increased zinc coating thickness, sacrificial steel thickness or alternative pile','Procurement lead-time for heavier coating'], L:3, C:3, mit:'Corrosion assessment for 25–30 year design life; specify coating class; confirm with pile vendor.', owner:'C&S consultant / Vendor'},
 {id:'RK-GEO-04', mod:'m10', t:'Insufficient SI coverage', cond:(R,P)=>R.GEO && R.GEO.res.bhPerHa < 1/25,
  chain:['Borehole density below screening target for site area','Unanticipated ground conditions between boreholes','Variation claims on piles, earthworks and roads','Delay pending supplementary SI'], L:3, C:4, mit:'Supplementary SI (boreholes, CPT, test pits) and pile driving trials before tender close.', owner:'Client / Developer'},
 {id:'RK-EW-01', mod:'m11', t:'Significant imported fill requirement', cond:(R)=>R.EWB && R.EWB.res.importV > 20000,
  chain:['Earthwork balance shows net import requirement','Borrow source identification, haul routes, public road usage','Imported fill cost and haulage exposure','Earthworks duration dependent on borrow supply rate'], L:3, C:3, mit:'Optimise platform levels; confirm borrow sources; consider lime/cement stabilisation of site-won material.', owner:'EPC'},
 {id:'RK-EW-02', mod:'m13', t:'Earthwork balance sensitive to bulking/shrinkage', cond:(R)=>R.CF && Math.abs(R.CF.res.net) > 0.15 * Math.max(1, R.CF.res.fillReq),
  chain:['Uncertain shrink/bulk factors and unsuitable depth','Material surplus or shortage during construction','Import / disposal quantity variance','Re-sequencing of earthworks'], L:3, C:3, mit:'Compaction trials; test pits to confirm topsoil & unsuitable thickness.', owner:'C&S consultant'},
 {id:'RK-TOPO-01', mod:'m8', t:'Steep terrain fraction exceeds tracker tolerance', cond:(R)=>R.GRD && R.GRD.res.majorPct > 5,
  chain:['Portion of array area exceeds tracker slope tolerance','Local grading and slope protection within array','Additional earthworks & erosion control cost','Earthworks precede piling in affected blocks'], L:3, C:3, mit:'Confirm tracker vendor slope tolerances; layout optimisation to avoid steep zones.', owner:'EPC / Tracker vendor'},
 {id:'RK-HYD-01', mod:'m15', t:'IDF coefficients not from official JPS station', cond:(R,P)=>R.IDF && R.IDF.meta && (R.IDF.meta.lam && ((P.conf.IDF||{}).lam||'Estimated')!=='Authority Data'),
  chain:['Design rainfall intensity based on non-official coefficients','Drainage and detention sizes may be under / over-estimated','Rework of drainage design and BOQ at detailed design','Delay to JPS approval'], L:4, C:3, mit:'Obtain official IDF coefficients for nearest station (MSMA / HP 1) before tender freeze.', owner:'C&S consultant'},
 {id:'RK-HYD-02', mod:'m18', t:'Detention storage large relative to land available', cond:(R)=>R.DET && R.DET.res.pondArea > 0.02 * (+P.info.landArea||1) * 10000,
  chain:['Required detention storage demands large pond footprint','Loss of PV developable area or deeper pond','Additional excavation / land cost; possible capacity reduction','Layout rework'], L:3, C:4, mit:'Consider distributed detention (swales, multiple ponds), confirm pre-development C with JPS.', owner:'C&S consultant / Developer'},
 {id:'RK-HYD-03', mod:'m16', t:'Drain capacity insufficient', cond:(R)=>R.MAN && R.MAN.status==='fail',
  chain:['Proposed drain section below design discharge','Overtopping, erosion of array roads and cable trench','Upsized drains / additional lining','Redesign before IFC'], L:3, C:3, mit:'Adopt auto-sized drain section; review gradients and lining.', owner:'C&S consultant'},
 {id:'RK-HYD-04', mod:'m19', t:'Flood-sensitive platforms below design flood level', cond:(R)=>R.FPL && R.FPL.res.fillMax > 1.0,
  chain:['Existing ground below required platform RL at substation/BESS','Raised platforms with significant fill and slopes / retaining walls','Fill import and retaining wall cost','Platform settlement period before equipment installation'], L:3, C:4, mit:'Obtain official flood levels (JPS); flood study where site within flood-prone area.', owner:'C&S consultant'},
 {id:'RK-HYD-05', mod:'m16', t:'Outfall capacity / tailwater unverified', cond:(R)=>R.OUT && R.OUT.status==='fail',
  chain:['Receiving drain / river capacity or tailwater not confirmed','Backwater into site drainage; outfall erosion','Outfall works, downstream upgrading as JPS condition','Approval delay'], L:3, C:4, mit:'Outfall survey, downstream capacity check, JPS consultation.', owner:'C&S consultant'},
 {id:'RK-RD-01', mod:'m24', t:'Heavy transport route / crossing capacity', cond:(R)=>R.HVY && R.HVY.status==='fail',
  chain:['Transformer / BESS delivery exceeds route or crossing capacity','Temporary strengthening, route change or crossing replacement','Strengthening works cost','Delivery delay of long-lead equipment'], L:3, C:4, mit:'Route survey; transporter axle configuration; culvert capacity assessment.', owner:'EPC / Transporter'},
 {id:'RK-RD-02', mod:'m21', t:'Low subgrade CBR', cond:(R)=>R.PAV && R.PAV.I.cbr < 5,
  chain:['Subgrade CBR below 5%','Rutting / failure of roads under construction traffic','Thicker pavement, geotextile or stabilisation','Road maintenance during construction'], L:3, C:3, mit:'In-situ CBR / DCP testing along road alignment; consider capping layer.', owner:'C&S consultant'},
 {id:'RK-BESS-01', mod:'m45', t:'BESS containment volume inadequate', cond:(R)=>R.BCON && R.BCON.status==='fail', types:['B'],
  chain:['Containment volume less than oil + fire-water + rainfall','Pollution release during fire/leak event','Larger sump / bund and interceptor','Redesign and authority re-submission'], L:2, C:5, mit:'Confirm fire-water demand with BOMBA/fire consultant; size containment per CIRIA C736 / client.', owner:'C&S consultant / Fire consultant'},
 {id:'RK-BESS-02', mod:'m43', t:'BESS vendor loads not confirmed', cond:(R,P)=>R.BFDN && ((P.conf.BFDN||{}).W||'Estimated')!=='Vendor Certified', types:['B'],
  chain:['BESS container weight, COG and anchorage loads assumed','Foundation redesign on receipt of vendor data','Concrete / reinforcement quantity change','IFC drawing delay'], L:4, C:3, mit:'Obtain certified vendor load data sheet before foundation IFC.', owner:'EPC / BESS vendor'},
 {id:'RK-GW-01', mod:'m10', t:'Shallow groundwater', cond:(R)=>R.GEO && R.GEO.res.gwlMin < 1.5,
  chain:['Groundwater within 1.5 m of existing ground','Dewatering for excavations, reduced bearing, uplift on sumps','Dewatering and buoyancy mitigation cost','Weather-sensitive excavation windows'], L:3, C:3, mit:'Groundwater monitoring (standpipes); dewatering method statement.', owner:'EPC'},
 {id:'RK-TND-01', mod:'m51', t:'Tender scope gaps identified', cond:(R,P)=>typeof TENDER !== 'undefined' && TENDER.gaps && TENDER.gaps.length > 0,
  chain:['Tender omits scope items required by engineering','Scope not priced; contractor claims at execution','Variation orders / cost overrun','Programme disruption during scope resolution'], L:4, C:4, mit:'Issue tender clarifications; require priced provisional items.', owner:'Tender engineer / QS'},
];

/* ---------- C&S tender checklist ---------- */
/* [id, category, item, module, auto('calc:ID' | 'doc:category' | ''), types] */
const CHECK_ROWS = [
 ['CL01','Survey & Site','Topographical survey (DTM, contours, spot levels) received and datum confirmed','m8','doc:Topographical Survey'],
 ['CL02','Survey & Site','Land title / lot boundary and area confirmed against land area in RFP','m9','doc:Land'],
 ['CL03','Survey & Site','Site visit carried out; access, watercourses and utilities recorded','m7',''],
 ['CL04','Survey & Site','Coordinates of key features in GDM2000 / WGS84 established','m3',''],
 ['CL05','Geotechnical','SI report with boreholes / SPT covering array, substation and BESS','m10','doc:Site Investigation'],
 ['CL06','Geotechnical','Soil chemistry (pH, SO₄, Cl, resistivity) for corrosion assessment','m10','calc:GEO'],
 ['CL07','Geotechnical','Pile driving trial / pull-out test data','m27','doc:Pile Test'],
 ['CL08','Geotechnical','Bearing capacity for shallow foundations assessed','m28','calc:BRG'],
 ['CL09','Earthworks','Cut & fill volumes calculated from DTM','m13','calc:CF'],
 ['CL10','Earthworks','Earthwork balance incl. topsoil, unsuitable, shrinkage/bulking','m11','calc:EWB'],
 ['CL11','Earthworks','Grading strategy vs tracker / fixed-tilt tolerances','m12','calc:GRD'],
 ['CL12','Earthworks','Cut / fill slope stability screened','m14','calc:SLP'],
 ['CL13','Hydrology & Drainage','Official IDF coefficients (JPS) obtained','m15','calc:IDF'],
 ['CL14','Hydrology & Drainage','Pre- vs post-development runoff comparison','m15','calc:RAT'],
 ['CL15','Hydrology & Drainage','Drain sizing by Manning incl. freeboard & velocity checks','m16','calc:MAN'],
 ['CL16','Hydrology & Drainage','Culvert hydraulic screening at road crossings','m17','calc:CUL'],
 ['CL17','Hydrology & Drainage','Detention storage sized to limit post-dev peak','m18','calc:DET'],
 ['CL18','Hydrology & Drainage','Outfall analysis (receiving water, tailwater, capacity)','m16','calc:OUT'],
 ['CL19','Hydrology & Drainage','Flood level obtained; platform RL set with freeboard','m19','calc:FPL'],
 ['CL20','Hydrology & Drainage','ESCP / LD-P2M2 measures sized','m20','calc:ESC'],
 ['CL21','Roads & Access','Pavement design for construction & permanent traffic','m21','calc:PAV'],
 ['CL22','Roads & Access','Main access junction & gradient check','m22','calc:ACC'],
 ['CL23','Roads & Access','Heavy transport route & crossings assessed','m24','calc:HVY'],
 ['CL24','Roads & Access','Crane hardstanding sized for heaviest lift','m25','calc:CRN'],
 ['CL25','Foundations','PV pile compression / uplift / lateral checks','m26','calc:PVP'],
 ['CL26','Foundations','PV pile structural check (combined, buckling)','m26','calc:PVS'],
 ['CL27','Foundations','Wind load on PV per MS EN 1991-1-4 NA','m26','calc:WND'],
 ['CL28','Foundations','Pile test schedule defined','m27','calc:PTS'],
 ['CL29','Foundations','Inverter / PCS foundation designed with vendor loads','m29','calc:FDN_INV'],
 ['CL30','Foundations','Transformer foundation & oil containment','m30','calc:FDN_TX'],
 ['CL31','Structures','Load combinations defined per MS EN 1990 NA','m33','calc:LCB'],
 ['CL32','Structures','Control / O&M building structural concept','m33','calc:RCF'],
 ['CL33','Cable & Services','Cable trench sections and quantities','m34','calc:CTR'],
 ['CL34','Cable & Services','Underground services crossing schedule','m35','calc:UGS'],
 ['CL35','Ancillary','Retaining walls at platform edges assessed','m36','calc:RTW'],
 ['CL36','Ancillary','Perimeter fence foundation checked for wind','m37','calc:FEN'],
 ['CL37','Ancillary','Water supply & sewerage requirements identified','m40','calc:WSP'],
 ['CL38','BESS','BESS platform level, fill and drainage fall','m43','calc:BPL','B'],
 ['CL39','BESS','BESS foundation checked with vendor loads','m31','calc:BFDN','B'],
 ['CL40','BESS','BESS containment volume (oil, coolant, fire-water, rain)','m45','calc:BCON','B'],
 ['CL41','BESS','BESS fire access & fire-water civil works','m42','calc:FWC','B'],
 ['CL42','Commercial','QTO linked to calculations','m48',''],
 ['CL43','Commercial','BOQ priced; rates reviewed','m49',''],
 ['CL44','Commercial','Tender reconciliation completed','m51',''],
 ['CL45','Compliance','Authority jurisdiction (PBT, JPS, JKR, BOMBA, DOE) identified','m57',''],
 ['CL46','Compliance','Standards register verified (edition / status)','m58',''],
 ['CL47','Compliance','Design criteria conflicts resolved by Engineer','m15',''],
 ['CL48','Risk','Design risk register reviewed','m54',''],
];

/* ---------- authority compliance matrix ---------- */
/* [auth, requirement, stage, ref, types] */
const AUTH_ROWS = [
 ['PBT','Planning permission (Kebenaran Merancang) — land use for solar farm','Pre-construction','TCPA / PLAN_GP'],
 ['PBT','Earthworks plan approval / permit','Pre-construction','SDBL / PBT_REQ'],
 ['PBT','Road & drainage plan approval','Pre-construction','SDBL / PBT_REQ'],
 ['PBT','Building plan approval (control building, O&M, guardhouse)','Pre-construction','UBBL'],
 ['PBT','CCC / completion certification (PSP / Form G)','Completion','PBT_REQ'],
 ['JPS','Drainage & stormwater (MSMA) submission incl. detention','Pre-construction','MSMA2'],
 ['JPS','ESCP submission','Pre-construction','JPS_ESC'],
 ['JPS','Outfall / river crossing / river reserve approval','Pre-construction','JPS_RR'],
 ['JPS','Flood level confirmation','Design','JPS_FLOOD'],
 ['JKR','Access junction to public (federal/state) road','Pre-construction','ATJ886'],
 ['JKR','Heavy vehicle / abnormal load route permit (with JPJ/police)','Construction','ATJ886'],
 ['DOE','EIA / prescribed activity screening','Feasibility','EIA2015'],
 ['DOE','LD-P2M2 compliance','Construction','LDP2M2'],
 ['BOMBA','Fire access, hydrant, fire-water for buildings','Pre-construction','UBBL / FSA'],
 ['BOMBA','BESS fire safety requirements (separation, fire-water, access)','Pre-construction','BOMBA_BESS','B'],
 ['DOSH','Crane / lifting equipment registration; BOWEC compliance','Construction','FMA / BOWEC'],
 ['CIDB','Project registration & levy','Pre-construction','CIDB520'],
 ['ST','Licence / installation requirements','Pre-COD','ESA / ST_LSS'],
 ['TNB','Substation civil interface, cable routes, POI access','Design','TNB_TG'],
 ['Water operator','Water supply connection','Pre-construction','SPAN_UTG'],
 ['IWK / SPAN','Sewerage (septic / package plant) approval','Pre-construction','MSIG'],
];

/* ---------- drawing register template ---------- */
const DRAWING_ROWS = [
 ['C-000','Drawing list & general notes','General'],['C-001','Location plan & key plan','General'],['C-002','Overall site layout & setting-out coordinates','General'],
 ['C-100','Existing topography & slope analysis','Earthworks'],['C-101','Earthworks (cut & fill) plan','Earthworks'],['C-102','Earthworks sections','Earthworks'],['C-103','Slope protection details','Earthworks'],
 ['C-200','Catchment plan (pre & post)','Drainage'],['C-201','Drainage layout plan','Drainage'],['C-202','Drain typical sections & details','Drainage'],['C-203','Culvert schedule & details','Drainage'],['C-204','Detention pond layout, sections & outlet','Drainage'],['C-205','Outfall details','Drainage'],
 ['C-250','ESCP plans & details (stages)','ESCP'],
 ['C-300','Road layout & setting-out','Roads'],['C-301','Road typical sections & pavement details','Roads'],['C-302','Main access junction layout','Roads'],['C-303','Crane hardstanding & laydown','Roads'],
 ['S-400','PV pile layout & schedule','Foundations'],['S-401','PV pile details','Foundations'],['S-402','Inverter / PCS foundation','Foundations'],['S-403','Transformer foundation & oil containment','Foundations'],
 ['S-410','Substation civil layout & foundations','Substation'],['S-420','Control / O&M building structure','Structural'],
 ['C-500','Cable trench layout & typical sections','Cable'],['C-501','Underground services crossing details','Cable'],
 ['C-600','Fence & gate layout and details','Ancillary'],['C-601','Retaining wall details','Ancillary'],['C-602','Water supply & sewerage layout','Ancillary'],
 ['S-700','BESS civil layout & platform levels','BESS','B'],['S-701','BESS foundations','BESS','B'],['C-702','BESS drainage & containment','BESS','B'],['C-703','Fire-water civil works & fire access','BESS','B'],
];

const DELIV_ROWS = [
 ['Design Basis Report (C&S)','Tender'],['C&S Tender Engineering Report','Tender'],['Calculation package (all calculation sheets)','Tender'],['Quantity take-off & BOQ','Tender'],
 ['Tender reconciliation & clarification register','Tender'],['Design risk register','Tender'],['Drainage & MSMA report (JPS submission)','Authority'],['ESCP / LD-P2M2 report','Authority'],
 ['Earthworks submission (PBT)','Authority'],['Geotechnical interpretative report','Design'],['Pile test report review','Construction'],['IFC drawings','Design'],['As-built drawings & survey','Completion'],['O&M manual (civil)','Completion'],
];

/* ---------- PBT database (screening; confirm with authority) ---------- */
const PBT_DB = {
 'Perak|Kerian':{pbt:'Majlis Daerah Kerian (MDK)'}, 'Perak|Batang Padang':{pbt:'Majlis Daerah Tapah'}, 'Perak|Kinta':{pbt:'Majlis Bandaraya Ipoh / Majlis Perbandaran Batu Gajah (by mukim)'},
 'Pahang|Pekan':{pbt:'Majlis Daerah Pekan'}, 'Selangor|Kuala Langat':{pbt:'Majlis Perbandaran Kuala Langat'}, 'Selangor|Sepang':{pbt:'Majlis Perbandaran Sepang'},
 'Kedah|Kuala Muda':{pbt:'Majlis Bandaraya Sungai Petani'}, 'Negeri Sembilan|Jempol':{pbt:'Majlis Perbandaran Jempol'}, 'Melaka|Alor Gajah':{pbt:'Majlis Perbandaran Alor Gajah'},
};
const PBT_FIELDS = ['Earthwork requirements','Road requirements','Drainage requirements','Planning','Building','Slope','Retaining wall','Submission requirements','Forms','Fees','Standard drawings'];

/* ---------- sample project ---------- */
function sampleInfo(type){
  return {
    name: type === 'B' ? 'LSS Demonstration 100 MWac Solar PV Farm + 50 MW / 200 MWh BESS' : 'LSS Demonstration 100 MWac Solar PV Farm',
    number:'IRDNA-DEMO-2026-01', client:'Demonstration Developer Sdn Bhd', developer:'Demonstration Developer Sdn Bhd', epc:'EPC (TBC)',
    consultant:'IRDNA Sdn Bhd (C&S)', location:'Gunong Semanggol (demonstration location)', state:'Perak', district:'Kerian', mukim:'Gunong Semanggol',
    pbt:'', lot:'PT 0000–PT 0003 (demonstration)', landArea:185, projType:type,
    mwp:132, mwac:100, bessMW: type === 'B' ? 50 : 0, bessMWh: type === 'B' ? 200 : 0, gridV:'132 kV', substation:'132/33 kV Main Intake Substation (on-site)', poi:'132 kV line-in-line-out (demonstration)',
    stage:'Tender', cod:'2028-12-31', prepared:'Engineer', checked:'', approved:''
  };
}
function sampleCoords(type){
  const c = [
   ['Project centroid',4.9950,100.6400,'Consultant estimate (demo)'],['Main entrance',4.9885,100.6331,'Consultant estimate (demo)'],
   ['Substation',4.9912,100.6372,'Consultant estimate (demo)'],['POI',4.9905,100.6360,'Consultant estimate (demo)'],
   ['Drainage outfall',5.0020,100.6475,'Consultant estimate (demo)'],['Detention pond',5.0006,100.6452,'Consultant estimate (demo)'],
   ['Road crossing CX-01 (culvert)',4.9960,100.6420,'Consultant estimate (demo)'],
  ];
  if (type === 'B') c.splice(3, 0, ['BESS',4.9920,100.6385,'Consultant estimate (demo)']);
  return c.map(r => ({id: uid(), label:r[0], lat:r[1], lon:r[2], src:r[3], datum:'WGS84', crs:'Geographic', epsg:'4326', rsoE:'', rsoN:''}));
}
function sampleBoreholes(){
  // layers: [from, to, description, type, N, gamma, c', phi', Cu, E(MPa)] ; values flagged by source
  return [
   {id:'BH-01', lat:4.9975, lon:100.6390, rl:14.6, depth:20.0, gwl:2.1, cbr:6, res:4200, ph:5.9, so4:120, cl:45, layers:[[0,1.5,'Soft sandy CLAY','CLAY',4,17,0,0,20,4],[1.5,6,'Firm to stiff sandy SILT','SILT',11,18,5,26,55,11],[6,12,'Medium dense silty SAND','SAND',24,19,0,32,0,24],[12,20,'Very dense SAND / weathered rock','SAND',50,20,0,38,0,60]]},
   {id:'BH-02', lat:4.9930, lon:100.6420, rl:12.9, depth:18.0, gwl:1.2, cbr:4, res:1800, ph:4.9, so4:310, cl:160, layers:[[0,2.5,'Very soft to soft CLAY','CLAY',2,16,0,0,12,2],[2.5,7,'Firm silty CLAY','CLAY',8,17.5,0,0,40,8],[7,13,'Medium dense SAND','SAND',21,19,0,31,0,21],[13,18,'Hard SILT / weathered granite','SILT',50,20,10,34,250,60]]},
   {id:'BH-03', lat:4.9910, lon:100.6370, rl:13.5, depth:15.0, gwl:2.8, cbr:8, res:5600, ph:6.2, so4:80, cl:30, layers:[[0,3,'Stiff sandy CLAY','CLAY',12,18.5,0,0,60,12],[3,6.5,'Very stiff SILT','SILT',25,19,8,30,125,25],[6.5,15,'Weathered granite (N≥50)','ROCK',50,21,0,40,0,80]]},
   {id:'BH-04', lat:5.0005, lon:100.6445, rl:11.8, depth:20.0, gwl:0.9, cbr:5, res:3100, ph:5.4, so4:150, cl:70, layers:[[0,2,'Soft CLAY','CLAY',3,16.5,0,0,18,3],[2,9,'Loose to medium dense clayey SAND','SAND',12,18.5,0,29,0,12],[9,20,'Dense SAND','SAND',38,19.5,0,35,0,40]]},
   {id:'BH-05', lat:4.9990, lon:100.6350, rl:15.9, depth:12.0, gwl:3.5, cbr:10, res:6800, ph:6.4, so4:60, cl:25, layers:[[0,2,'Stiff sandy SILT','SILT',14,18.5,5,28,70,14],[2,4.5,'Very stiff SILT','SILT',30,19.5,10,31,150,30],[4.5,12,'Weathered granite (N≥50)','ROCK',50,21,0,40,0,80]]},
   {id:'BH-06', lat:4.9920, lon:100.6385, rl:13.1, depth:18.0, gwl:1.8, cbr:7, res:3900, ph:5.8, so4:110, cl:55, layers:[[0,2,'Firm sandy CLAY','CLAY',7,17.5,0,0,35,7],[2,8,'Medium dense silty SAND','SAND',18,19,0,31,0,18],[8,18,'Dense to very dense SAND','SAND',42,20,0,36,0,45]]},
  ];
}
function sampleSubcatchments(){
  // id, area ha, landuse pre, C pre, landuse post, C post, L overland m, slope %, n* pre, n* post, Lc m (drain), Sc %
  return [
   {id:'SC-1', area:32, preUse:'Oil palm / scrub', cPre:0.40, postUse:'PV array on grass + internal roads', cPost:0.52, L:120, S:2.0, nPre:0.060, nPost:0.045, Lc:650, Sc:0.6},
   {id:'SC-2', area:41, preUse:'Oil palm / scrub', cPre:0.40, postUse:'PV array on grass + internal roads', cPost:0.52, L:150, S:1.5, nPre:0.060, nPost:0.045, Lc:820, Sc:0.5},
   {id:'SC-3', area:36, preUse:'Oil palm / scrub', cPre:0.40, postUse:'PV array on grass + internal roads', cPost:0.52, L:130, S:2.5, nPre:0.060, nPost:0.045, Lc:700, Sc:0.7},
   {id:'SC-4', area:38, preUse:'Grassland', cPre:0.35, postUse:'PV array on grass + internal roads', cPost:0.50, L:110, S:1.8, nPre:0.050, nPost:0.045, Lc:760, Sc:0.5},
   {id:'SC-5', area:28, preUse:'Scrub', cPre:0.38, postUse:'PV array + laydown', cPost:0.55, L:100, S:2.2, nPre:0.060, nPost:0.045, Lc:540, Sc:0.6},
   {id:'SC-6', area:10, preUse:'Grassland', cPre:0.35, postUse:'Substation / BESS / buildings (gravel & concrete)', cPost:0.80, L:60, S:1.0, nPre:0.050, nPost:0.015, Lc:300, Sc:0.5},
  ];
}
function samplePlatforms(type){
  const p = [
   {id:'PF-SS', name:'Main intake substation', x0:30, y0:48, w:6, h:5, rl:0, gx:0.5, gy:0.0, auto:true},
   {id:'PF-OM', name:'O&M / control building compound', x0:22, y0:52, w:3, h:3, rl:0, gx:0.5, gy:0.0, auto:true},
   {id:'PF-LD', name:'Laydown area (temporary)', x0:14, y0:54, w:5, h:4, rl:0, gx:1.0, gy:0.0, auto:true},
  ];
  if (type === 'B') p.splice(1, 0, {id:'PF-BESS', name:'BESS compound', x0:37, y0:47, w:8, h:6, rl:0, gx:0.5, gy:0.0, auto:true});
  return p;
}
function sampleTender(type){
  // Contractor quotation (demonstration) — deliberately includes omissions, under/over-quantities, exclusions and duplication
  const t = [
   ['SURV_TOPO',185,320,'Topographical survey',''],['SI_BH',6,9000,'6 boreholes','Provisional'],
   ['EW_CLEAR',185,3200,'Clearing & grubbing',''],['EW_STRIP',270000,6,'Strip 150 mm',''],['EW_CUT',120000,7.5,'Cut to fill',''],['EW_CUT',20000,7.5,'Cut (platforms)',''],
   ['EW_FILL',95000,6.5,'Fill & compact',''],['EW_IMPORT',9000,26,'Imported fill',''],['EW_DISP',30000,9,'Disposal',''],
   ['RD_SUBBASE',5200,70,'Sub-base 200 mm',''],['RD_BASE',3600,88,'Crusher run 150 mm',''],['RD_SUBGRADE',26000,2.2,'Subgrade prep',''],
   ['DR_EARTH',9000,30,'Earth drains',''],['DR_CONC',1200,300,'Concrete drain — size TBC','TBC'],['DR_PIPE',180,800,'RC pipes 900 mm',''],['DR_HEADWALL',14,6000,'Headwalls',''],
   ['DR_POND_EXC',25000,8.5,'Detention pond',''],['DR_OUTLET',1,40000,'Outlet structure',''],
   ['ES_FENCE',7000,11,'Silt fence',''],['ES_TRAP',20,3200,'Silt traps',''],
   ['PL_PV',41000,305,'PV piles C-section',''],['PL_PREDRILL',2000,130,'Predrilling','Provisional'],['PL_TEST_C',6,8500,'Compression tests',''],['PL_TEST_T',6,6500,'Uplift tests',''],
   ['CN_G30',520,420,'Foundations concrete',''],['RF_Y',38,4700,'Rebar',''],['FW_FORM',900,50,'Formwork',''],
   ['CT_EXC',22000,17,'Cable trench',''],['CT_SAND',8000,80,'Sand bedding',''],['CT_BACK',12000,11,'Backfill',''],
   ['FN_FENCE',7800,150,'Perimeter fence',''],['FN_GATE',2,14000,'Gates',''],['FW_HARD',600,110,'Fire access hardstanding',''],
   ['AU_SUB',0,0,'Authority submissions — EXCLUDED by contractor','Excluded'],['TEST_MAT',1,70000,'Material testing',''],
  ];
  if (type === 'B') t.push(['BS_GRAVEL',9000,17,'BESS gravel',''],['BS_CONT',1,28000,'Transformer bund only','']);
  return t.map(r => ({id: uid(), key:r[0], qty:r[1], rate:r[2], scope:r[3], flag:r[4]}));
}
function sampleDocs(type){
  const d = [
   ['DOC-001','RFP / Employer\'s Requirements (C&S sections)','Tender Document','Received','Client','m5'],
   ['DOC-002','Topographical survey (preliminary, 1 m contours)','Topographical Survey','Received','Client','m8'],
   ['DOC-003','Site investigation factual report (6 BH)','Site Investigation','Received','Client','m10'],
   ['DOC-004','Land title / lot plans','Land','Partial','Client','m9'],
   ['DOC-005','PV layout (preliminary, tracker)','Layout','Received','EPC','m26'],
   ['DOC-006','Tracker vendor load & slope tolerance data','Vendor Data','Pending','Vendor','m26'],
   ['DOC-007','Inverter / MV skid load data','Vendor Data','Pending','Vendor','m29'],
   ['DOC-008','JPS IDF coefficients (nearest station)','Hydrology','Pending','JPS','m15'],
   ['DOC-009','Flood level data (JPS)','Hydrology','Pending','JPS','m19'],
   ['DOC-010','Pile driving trial / pull-out test','Pile Test','Not available','EPC','m27'],
   ['DOC-011','Contractor civil quotation (tender)','Tender Quotation','Received','Contractor','m51'],
   ['DOC-012','Transport route survey','Transport','Not available','Transporter','m24'],
  ];
  if (type === 'B') d.push(['DOC-013','BESS container / PCS vendor data (weight, COG, anchorage)','Vendor Data','Pending','Vendor','m31'],['DOC-014','BESS fire-water demand (fire consultant)','Fire','Pending','Fire consultant','m42']);
  return d.map(r => ({id:r[0], title:r[1], cat:r[2], status:r[3], from:r[4], mod:r[5], rev:'0', date:'', notes:''}));
}
