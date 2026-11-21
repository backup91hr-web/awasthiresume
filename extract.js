// Awasthi Resume: pull candidate details (name, post, city, experience, skills) out of resume text.
// Heuristics only: the team checks the form before saving.
(() => {
  "use strict";

  const CITIES = [
    // Punjab, Haryana, Himachal, J&K, Chandigarh
    "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Sahibzada Ajit Singh Nagar", "Chandigarh", "Panchkula",
    "Hoshiarpur", "Pathankot", "Moga", "Firozpur", "Ferozepur", "Kapurthala", "Phagwara", "Sangrur", "Barnala", "Mansa", "Faridkot",
    "Muktsar", "Sri Muktsar Sahib", "Fazilka", "Abohar", "Gurdaspur", "Batala", "Tarn Taran", "Rupnagar", "Ropar", "Nawanshahr",
    "Shaheed Bhagat Singh Nagar", "Fatehgarh Sahib", "Sirhind", "Khanna", "Rajpura", "Zirakpur", "Kharar", "Dera Bassi", "Malerkotla",
    "Nabha", "Samana", "Jagraon", "Mandi Gobindgarh", "Sunam", "Anandpur Sahib", "Nangal", "Dhuri", "Banga", "Mukerian", "Dasuya",
    "Ambala", "Yamunanagar", "Kurukshetra", "Karnal", "Panipat", "Sonipat", "Rohtak", "Hisar", "Sirsa", "Fatehabad", "Jind", "Kaithal",
    "Bhiwani", "Rewari", "Gurugram", "Gurgaon", "Faridabad", "Palwal", "Jhajjar", "Shimla", "Solan", "Baddi", "Mandi", "Kangra",
    "Dharamshala", "Una", "Hamirpur", "Kullu", "Bilaspur", "Nalagarh", "Jammu", "Srinagar", "Kathua",
    // Major Indian cities
    "Delhi", "New Delhi", "Noida", "Greater Noida", "Ghaziabad", "Mumbai", "Navi Mumbai", "Thane", "Pune", "Nagpur", "Nashik",
    "Aurangabad", "Bengaluru", "Bangalore", "Mysuru", "Mysore", "Hyderabad", "Secunderabad", "Chennai", "Coimbatore", "Madurai",
    "Kolkata", "Howrah", "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner",
    "Sri Ganganagar", "Lucknow", "Kanpur", "Agra", "Varanasi", "Prayagraj", "Allahabad", "Meerut", "Bareilly", "Aligarh", "Moradabad",
    "Saharanpur", "Gorakhpur", "Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Bhopal", "Indore", "Gwalior", "Jabalpur",
    "Raipur", "Bhilai", "Patna", "Gaya", "Ranchi", "Jamshedpur", "Dhanbad", "Bhubaneswar", "Cuttack", "Guwahati", "Kochi", "Cochin",
    "Thiruvananthapuram", "Trivandrum", "Kozhikode", "Visakhapatnam", "Vijayawada", "Goa", "Panaji", "Margao", "Mangaluru", "Mangalore",
    "Hubli", "Belgaum", "Belagavi", "Puducherry", "Pondicherry", "Tiruchirappalli", "Salem", "Vellore",
  ];
  const TITLES = [
    "Chartered Accountant", "Senior Accountant", "Junior Accountant", "Accounts Executive", "Accounts Manager", "Accounts Assistant",
    "Accountant", "Auditor", "Tax Consultant", "Finance Executive", "Finance Manager", "Cashier", "Billing Executive",
    "Software Engineer", "Software Developer", "Senior Software Engineer", "Web Developer", "Full Stack Developer", "Frontend Developer",
    "Backend Developer", "Java Developer", "Python Developer", "PHP Developer", "Android Developer", "Data Analyst", "Data Scientist",
    "Business Analyst", "System Administrator", "Network Engineer", "IT Support", "Technical Support", "QA Engineer", "Tester",
    "Graphic Designer", "UI/UX Designer", "Digital Marketing Executive", "SEO Executive", "Content Writer",
    "HR Executive", "HR Manager", "HR Generalist", "HR Recruiter", "Recruiter", "Talent Acquisition", "Payroll Executive", "Admin Executive",
    "Office Assistant", "Office Executive", "Back Office Executive", "Front Office Executive", "Receptionist", "Data Entry Operator",
    "Computer Operator", "Clerk", "Store Keeper", "Storekeeper", "Store Manager", "Inventory Executive", "Purchase Executive",
    "Purchase Manager", "Logistics Executive", "Supply Chain Executive", "Warehouse Supervisor",
    "Sales Executive", "Sales Manager", "Sales Officer", "Area Sales Manager", "Business Development Executive",
    "Business Development Manager", "Marketing Executive", "Marketing Manager", "Relationship Manager", "Branch Manager",
    "Customer Care Executive", "Customer Support Executive", "Customer Service Executive", "Telecaller", "Tele Caller",
    "Mechanical Engineer", "Civil Engineer", "Electrical Engineer", "Production Engineer", "Quality Engineer", "Site Engineer",
    "Project Engineer", "Maintenance Engineer", "Design Engineer", "Production Supervisor", "Quality Inspector", "Supervisor",
    "Project Manager", "Operations Manager", "Operations Executive", "General Manager", "Plant Manager", "Manager",
    "Electrician", "Fitter", "Welder", "Machine Operator", "CNC Operator", "Technician", "Mechanic", "Plumber", "Carpenter",
    "Driver", "Security Guard", "Helper", "Peon", "Cook", "Chef",
    "Teacher", "Lecturer", "Professor", "Tutor", "Nurse", "Staff Nurse", "Pharmacist", "Lab Technician", "Doctor",
  ];
  const SKILL_WORDS = [
    "Tally ERP 9", "Tally Prime", "Tally", "GST", "TDS", "Income Tax", "Busy", "SAP", "Excel", "Advanced Excel", "MS Office", "MS Word",
    "PowerPoint", "Accounting", "Bookkeeping", "Payroll", "Banking", "Billing", "Data Entry", "Typing", "Communication",
    "Java", "Python", "JavaScript", "React", "Node.js", "PHP", "SQL", "MySQL", "HTML", "CSS", "C++", "Android", "AutoCAD",
    "SolidWorks", "Photoshop", "CorelDRAW", "Illustrator", "Digital Marketing", "SEO", "Recruitment", "Sales", "Marketing",
    "Customer Service", "Team Management", "Inventory", "Purchase", "Logistics", "Welding", "Wiring", "Driving",
  ];
  const NOT_NAME = /\b(resume|r[eé]sum[eé]|curriculum|vitae|cv|bio\s*-?data|biodata|profile|objective|career|summary|contact|e-?mail|mobile|phone|address|page|personal|details|information|declaration|experience|education|skills?)\b/i;
  const HEADING = /^(career\s+)?(objective|summary|profile|experience|work\s+experience|professional\s+experience|employment|education|educational|academic|qualification|qualifications|projects?|personal|personal\s+details|declaration|languages?|hobbies|interests|strengths|certifications?|achievements?|training|references?|contact|address)\b/i;

  const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordRe = (w) => new RegExp(`(^|[^A-Za-z])${esc(w)}([^A-Za-z]|$)`, "i");

  function findName(lines, fileName) {
    for (const l of lines) {
      const m = l.match(/^\s*(?:full\s+)?name\s*[:\-–]\s*([A-Za-z][A-Za-z.' ]{2,50})$/i);
      if (m) return titleCase(m[1]);
    }
    for (const raw of lines.slice(0, 10)) {
      const l = raw.replace(/^[^A-Za-z]+|[^A-Za-z.]+$/g, "");
      const words = l.split(/\s+/).filter(Boolean);
      if (words.length < 1 || words.length > 4) continue;
      if (!/^[A-Za-z][A-Za-z.' ]{2,40}$/.test(l)) continue;
      if (NOT_NAME.test(l) || TITLES.some((t) => wordRe(t).test(l)) || CITIES.some((c) => c.toLowerCase() === l.toLowerCase())) continue;
      return titleCase(l);
    }
    // fall back to the file name: "Amritpal_Singh_PATIALA.pdf" -> "Amritpal Singh"
    let n = (fileName || "").replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " ")
      .replace(/\b(resume|cv|biodata|updated|final|new|latest|copy|\d+)\b/gi, " ");
    for (const c of CITIES) n = n.replace(wordRe(c), " ");
    // generic scanner / phone file names are not a person's name
    n = n.replace(/\b(scan|scanned|camscanner|document|doc|docs|img|image|photo|pic|whatsapp|wa|pdf|file|untitled|page|copy|of|and|at|am|pm)\b/gi, " ");
    n = n.replace(/\s+/g, " ").trim();
    return n.length >= 3 && /[a-z]/i.test(n) ? titleCase(n) : "";
  }

  function findCity(lines, fileName) {
    const prio = lines.filter((l) => /address|city|location|residence|resident|r\/o|village|vpo|v\.?p\.?o|distt?|tehsil|pin/i.test(l));
    for (const group of [prio, lines, [fileName || ""]]) {
      const text = group.join(" \n ");
      let best = null;
      for (const c of CITIES) {
        const m = text.match(wordRe(c));
        if (m && (best === null || m.index < best.i)) best = { i: m.index, c };
      }
      if (best) {
        const map = { gurgaon: "Gurugram", bangalore: "Bengaluru", "sahibzada ajit singh nagar": "Mohali", ropar: "Rupnagar",
          ferozepur: "Firozpur", allahabad: "Prayagraj", cochin: "Kochi", trivandrum: "Thiruvananthapuram", mysore: "Mysuru" };
        return map[best.c.toLowerCase()] || best.c;
      }
    }
    return "";
  }

  function findExperience(lines) {
    const re = /(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:and|&|,)?\s*(\d{1,2})\s*(?:months?|mos?))?/i;
    const candidates = [];
    for (const l of lines) {
      if (/\bage\b|years?\s+old|\bborn\b|d\.?o\.?b/i.test(l)) continue;
      const m = l.match(re);
      if (!m) continue;
      let y = parseFloat(m[1]); if (m[2]) y += parseInt(m[2], 10) / 12;
      if (!(y >= 0 && y < 50)) continue;
      candidates.push({ y, strong: /experience|\bexp\b|worked|working/i.test(l) });
    }
    const pick = candidates.find((c) => c.strong) || candidates[0];
    if (pick) return Math.round(pick.y * 2) / 2;
    if (lines.some((l) => /\bfresher\b/i.test(l))) return 0;
    return null;
  }

  function findPost(lines, name) {
    const label = /(?:post\s*applied\s*for|position\s*applied\s*for|applied\s*for(?:\s*the\s*post\s*of)?|designation|current\s*(?:role|position|designation)|job\s*title|position)\s*[:\-–]\s*(.{3,60})/i;
    for (const l of lines) { const m = l.match(label); if (m) return titleCase(m[1].replace(/[.,;]+$/, "")); }
    // a short line right below the name that names a job
    const ni = name ? lines.findIndex((l) => l.toLowerCase().includes(name.toLowerCase())) : -1;
    if (ni >= 0) {
      for (const l of lines.slice(ni + 1, ni + 3)) {
        if (l.split(/\s+/).length <= 6 && !/\d|@/.test(l) && TITLES.some((t) => wordRe(t).test(l))) return titleCase(l.replace(/[|•·]/g, " "));
      }
    }
    const text = lines.join(" \n ");
    let best = null;
    for (const t of TITLES) {
      const m = text.match(wordRe(t));
      if (m && (best === null || m.index < best.i || (m.index === best.i && t.length > best.t.length))) best = { i: m.index, t };
    }
    return best ? best.t : "";
  }

  function findSkills(lines) {
    const start = lines.findIndex((l) => /^\W*((key|technical|computer|professional|it|core|soft)\s+)?skills?\b|^\W*skill\s*set|^\W*competenc/i.test(l) && l.length < 120);
    if (start >= 0) {
      const parts = [];
      const first = lines[start].split(/[:\-–]/).slice(1).join(" ").trim();
      if (first) parts.push(first);
      for (const l of lines.slice(start + 1, start + 10)) {
        const clean = l.replace(/^\W+/, "").trim();
        if (!clean) continue;
        if (HEADING.test(clean) && clean.split(/\s+/).length <= 4) break;
        parts.push(clean);
        if (parts.join(", ").length > 260) break;
      }
      let s = parts.join(", ").replace(/\s*[•●▪■◦*|]\s*/g, ", ").replace(/\s{2,}/g, " ").replace(/(,\s*){2,}/g, ", ").replace(/^,\s*|,\s*$/g, "");
      if (s.length > 250) s = s.slice(0, 250).replace(/,[^,]*$/, "");
      if (s.length >= 3) return s;
    }
    const text = lines.join(" \n ");
    const found = [];
    for (const w of SKILL_WORDS) {
      if (found.some((f) => f.toLowerCase().includes(w.toLowerCase()))) continue;
      if (wordRe(w).test(text)) found.push(w);
      if (found.length >= 10) break;
    }
    return found.join(", ");
  }

  window.AwasthiExtract = function (text, fileName) {
    const lines = String(text || "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const name = findName(lines, fileName);
    return {
      name,
      post: findPost(lines, name),
      city: findCity(lines, fileName),
      experience_years: findExperience(lines),
      skills: findSkills(lines),
    };
  };
})();
