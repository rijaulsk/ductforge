import type { Guide } from "./types";

/* बोलचाल की हिन्दी-उर्दू — the register actually spoken on a site, not
 * textbook शुद्ध हिन्दी. Technical nouns stay in English for the same reason
 * they do in the Bengali guide: nobody in this trade says anything else. */

export const hi: Guide = {
  locale: "hi",
  htmlLang: "hi",
  path: "/guide/hi",
  label: "हिन्दी",

  metaTitle: "DuctForge कैसे इस्तेमाल करें — डक्ट टेकऑफ़ गाइड",
  metaDescription:
    "क़दम-दर-क़दम डक्टवर्क टेकऑफ़: billing और shop standard का फ़र्क़, fittings भरना, ड्रॉइंग मिलाना, और schedule export करना।",

  eyebrow: "गाइड",
  title: "डक्ट जॉब का टेकऑफ़ कैसे करें",
  lede: [
    "आठ स्टेप, पढ़ने में पाँच मिनट, और दोबारा पढ़ने की ज़रूरत नहीं पड़ेगी। पहला स्टेप ध्यान से पढ़िए — आप किस measurement standard पर माप रहे हैं, वही तय करता है कि नीचे के सारे नंबर क्या आएँगे।",
    "आपका काम आपके ही device पर रहता है, कहीं जाता नहीं। तो बेफ़िक्र होकर आज़माइए — यहाँ कुछ बिगड़ने वाला नहीं है।",
  ],

  standardsHeading: "सबसे पहले, वो एक फ़ैसला जो सब तय करता है",
  standardsLede:
    "एक ही डक्ट, पूछने वाला कौन है उस पर हिसाब बदल जाता है। ग़लत standard चुना तो नीचे का हर नंबर ग़लत होगा — और देखने में बिल्कुल ठीक लगेगा।",
  standards: [
    {
      name: "Billing",
      body: "नॉमिनल माप — mean perimeter गुणा centreline length, यानी BOQ / IS 655 / DW 144 का तरीक़ा। क्लाइंट, कंसल्टेंट या quantity surveyor को बिल क्लेम करते वक़्त यही चाहिए। वो आपका invoice इसी हिसाब से मिलाएँगे।",
    },
    {
      name: "Shop",
      body: "जो असल में कटता है — वो खुला हुआ blank, transition की slant, bend की heel arc और round elbow की gore development समेत। शीट ख़रीदते वक़्त या वर्कशॉप को काम देते वक़्त यही लगता है। ये billing quantity नहीं है, और इसे कभी बिल में मत दीजिए।",
    },
  ],

  stepsHeading: "काम का तरीक़ा",
  steps: [
    {
      title: "Standard, unit और material तय कीजिए",
      body: [
        "ऊपर की बार में billing/shop और metric/imperial — दोनों पूरे टेकऑफ़ पर लगते हैं। Unit जब चाहें बदलिए, कुछ नहीं जाएगा: नाप मिलीमीटर में रखी जाती है, इसलिए बदलने में कोई rounding नहीं होती।",
        "शीट का material नीचे Material and allowances panel में है। Default GI है; stainless और aluminium सिर्फ़ वज़न बदलते हैं, और कुछ नहीं — क्योंकि gauge का मतलब ही thickness है।",
      ],
      figure: "standard",
      callouts: [
        "Unit। स्क्रीन पर सब कुछ बदल जाता है; आपकी नाप convert होती है, दोबारा टाइप नहीं करनी पड़ती।",
        "Measurement standard। ऊपर वाला वही फ़ैसला — बाक़ी सब से पहले इसे ठीक कर लीजिए।",
        "Material, schedule के नीचे वाले panel में। वज़न बदलता है, area कभी नहीं।",
      ],
    },
    {
      title: "फ़िटिंग चुनिए",
      body: [
        "छह rectangular और तीन round। सीधा रन है तो Straight; साइज़ बदल रहा है तो Reducer; मुड़ रहा है तो Elbow; बग़ल में सरक रहा है तो Dropper; branch निकल रहा है तो Collar या Y-piece।",
        "आप जिस zone में काम कर रहे थे वो बना रहता है, तो AHU-1 की बारह fittings के लिए बारह बार zone लिखना नहीं पड़ेगा।",
      ],
      figure: "picker",
      callouts: [
        "Rectangular: straight duct, reducer, elbow, dropper, collar और Y-piece।",
        "Round और spiral: सादा डक्ट, gored elbow और concentric cone।",
      ],
    },
    {
      title: "नाप भरिए",
      body: [
        "हर ख़ाने के आगे formula वाला symbol लिखा है, तो नतीजे के नीचे जो हिसाब दिख रहा है उसे आप ख़ानों से मिला सकते हैं।",
        "दो जगह लोग चूक जाते हैं। Rectangular elbow में R अंदर वाला (throat) radius है, centreline नहीं। और round elbow में R centreline radius है — round duct में यही चलन है, आम तौर पर diameter का डेढ़ गुना।",
      ],
      figure: "params",
      callouts: [
        "हर label के आगे वाला symbol वही है जो formula में लगता है।",
        "Rectangular elbow में R अंदर वाला radius है। Round elbow में वो centreline है।",
        "आपके नंबरों वाला हिसाब। कोई भी लाइन मेज़ के कैलकुलेटर से मिला लीजिए।",
      ],
    },
    {
      title: "ड्रॉइंग देख लीजिए",
      body: [
        "Blueprint में fitting नाप के साथ आती है, और formula की हर नाप उस पर दिखती है। Flat pattern में वो blank है जो वर्कशॉप काटेगा: ठोस लाइन मतलब कट, डैश लाइन मतलब मोड़। Isometric में चीज़ कैसी दिखती है — reducer समझकर dropper डाल दिया हो तो यहीं सबसे जल्दी पकड़ में आता है।",
        "Seam lap और flange का माल जान-बूझकर flat pattern में नहीं खींचा गया — वो waste allowance में पहले से है, दोबारा गिनने पर हिसाब बढ़ जाएगा।",
      ],
      figure: "drawing",
      callouts: [
        "तीन view। आप जो चुनेंगे वही रहता है — नाप बदलने से view वापस नहीं बदलता।",
        "Formula की हर नाप ड्रॉइंग पर है, और जो formula में नहीं है वो ड्रॉइंग पर भी नहीं।",
      ],
    },
    {
      title: "कितने पीस और कितना waste",
      body: [
        "Pieces से लाइन गुणा होती है। Allowance आपका फ़ैसला है: net BOQ claim में 0%, factory-run सीधे डक्ट में 8%, आम flanged काम में 12%, पेचीदा fittings और भारी gauge में 15–20%।",
        "Gauge सबसे बड़ी नाप देखकर ख़ुद चुन लिया जाता है, लेकिन किसी भी लाइन पर आप बदल सकते हैं — और जहाँ spec कुछ और कहता है, वहाँ बदलना ही चाहिए।",
      ],
      figure: "quantity",
      callouts: [
        "Pieces। एक लाइन में जितनी चाहें एक जैसी fittings रख सकते हैं।",
        "Allowance — preset से या ख़ुद टाइप करके। आम flanged काम में 12%।",
        "Gauge। टेबल पर छोड़ दीजिए, या spec अलग हो तो हाथ से बैठा दीजिए।",
      ],
    },
    {
      title: "टेकऑफ़ में जोड़िए",
      body: [
        "जब तक Add नहीं दबाते, schedule में कुछ नहीं जाता। तब तक वो सिर्फ़ draft है: बदलिए, नंबर हिलते हुए देखिए, और ठीक लगे तभी जोड़िए।",
        "बाद में कोई भी लाइन edit, duplicate या delete हो सकती है। एक जैसी fittings अलग-अलग लंबाई में लेनी हों तो duplicate सबसे तेज़ रास्ता है।",
      ],
      figure: "schedule",
      callouts: [
        "स्क्रीन का इकलौता नारंगी बटन। इसे दबाए बिना schedule में कुछ नहीं जाता।",
        "हर लाइन edit, duplicate या delete होती है। Duplicate कीजिए और सिर्फ़ लंबाई बदल दीजिए।",
      ],
    },
    {
      title: "Zone, insulation, flange और hanger",
      body: [
        "Zone मतलब जिस हिसाब से आप बिल करते हैं — AHU-1, Level 3, Kitchen। एक ही नाम देंगे तो वो लाइनें साथ जुड़कर total होंगी।",
        "Material and allowances में बाहरी सतह की insulation, डक्ट जितनी लंबाई में आता है उस हिसाब से flange ends, और आपकी spacing पर hangers भी गिनवा सकते हैं। तीनों बंद रहते हैं जब तक आप चालू न करें, क्योंकि जो हिसाब किसी ने माँगा ही नहीं, उसे किसी ने जाँचा भी नहीं होता।",
      ],
      figure: "zones",
      callouts: [
        "Zone। एक बार लिखिए — अगली fitting चुनने पर भी वो बना रहता है।",
        "Insulation, flange और hanger — जब तक आप नहीं बैठाते, तीनों बंद।",
      ],
    },
    {
      title: "Total देखिए और बाहर निकालिए",
      body: [
        "Totals में net area, waste, gross area और वज़न मिलता है, फिर gauge के हिसाब से माल और हर gauge के लिए शीट का अंदाज़ा। प्रति किलो या प्रति m² अपना rate डाल दीजिए, तो आपके ही हिसाब से क़ीमत निकल आएगी।",
        "CSV में input और result दोनों जाते हैं, इसलिए एक साल बाद भी फ़ाइल ख़ुद अपनी बात कह देती है। Save से project file बनती है — बाद में खोल सकते हैं, किसी और को दे भी सकते हैं। Print से issue करने लायक़ quantity sheet निकलती है, जिस पर standard, unit, allowance और सारी assumptions छपी रहती हैं।",
      ],
      figure: "totals",
      callouts: [
        "आख़िरी हिसाब। Gross = net + आपका allowance; वज़न = gross × साथ में दिखी density।",
        "Gauge के हिसाब से, क्योंकि 24 ga शीट से 22 ga नहीं कटता। शीट की गिनती अंदाज़ा है।",
        "Save काम को फ़ाइल में रखता है, CSV spreadsheet में जाता है, Print issue करने लायक़ sheet देता है।",
      ],
    },
  ],

  watchHeading: "जान लेना ठीक रहेगा",
  watch: [
    {
      title: "Gauge सिर्फ़ साइज़ देखकर चुना जाता है",
      body: "असल SMACNA चुनाव में pressure class और reinforcement spacing भी लगते हैं। टेबल को शुरुआत मानिए और spec से मिला लीजिए।",
    },
    {
      title: "Round duct भी rectangular टेबल पर ही मापा जा रहा है",
      body: "SMACNA की round और spiral के लिए अलग और आम तौर पर हल्की टेबल है, जो इस app में नहीं है — इसलिए round थोड़ा भारी आता है। spec अलग हो तो gauge बदल दीजिए।",
    },
    {
      title: "शीट की गिनती सिर्फ़ अंदाज़ा है",
      body: "gross area बँटा एक शीट, ऊपर की तरफ़ round, हर gauge के लिए अलग। आपका वर्कशॉप कैसे nesting करता है ये उसे नहीं पता, और कटे टुकड़े दोबारा इस्तेमाल हों तो नंबर दोनों तरफ़ हिलता है।",
    },
    {
      title: "सब कुछ इसी device पर है",
      body: "browser का data साफ़ किया तो टेकऑफ़ भी साफ़। काम ज़रूरी है तो Save करके फ़ाइल रख लीजिए — वही फ़ाइल एक मशीन से दूसरी पर ले जाने वाली कॉपी है।",
    },
  ],

  openApp: "कैलकुलेटर खोलिए",
  seeStandards: "सारे formula और constants",
  switcherLabel: "ये गाइड पढ़िए",
  nav: { calculator: "कैलकुलेटर", guide: "गाइड", standards: "स्टैंडर्ड" },
  figureLabel: "स्क्रीन पर क्या दिखेगा",
};
