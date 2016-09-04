/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Получает курсы драг металлов с сайта Сбербанка

Сайт: http://data.sberbank.ru/moscow/ru/quotes/metal
*/

var g_headers = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Charset': 'windows-1251,utf-8;q=0.7,*;q=0.3',
  'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
  'Connection': 'keep-alive',
  'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.76 Safari/537.36',
};

function computeHash(e) {
    for (var t = 2166136261, n = t, o = 0; o < e.length; ++o)
        n ^= e.charCodeAt(o),
        n += (n << 1) + (n << 4) + (n << 7) + (n << 8) + (n << 24);
    return n >>> 0
}

var g_iso_to2letters = {
	palladium: 'Pl',
	platinum: 'Pt',
	Gold: 'Au',
	Silver: 'Ag'
};

function main(){
  var prefs = AnyBalance.getPreferences();
  AnyBalance.setDefaultCharset('utf-8');

  var region = findRegion(prefs.region).REGION_ID;

  var body = '{"currencyData":[{"currencyCode":"A98","rangesAmountFrom":[0]},{"currencyCode":"A99","rangesAmountFrom":[0]},{"currencyCode":"A33","rangesAmountFrom":[0]},{"currencyCode":"A76","rangesAmountFrom":[0]}],"categoryCode":"base"}';
  var html = AnyBalance.requestPost('http://www.sberbank.ru/portalserver/proxy/?pipe=shortCachePipe&url=http%3A%2F%2Flocalhost%2Fsbt-services%2Fservices%2Frest%2FrateService%2Frate%3FregionId%3D' + region + '%26fromDate%3D' + getFormattedDate({offsetDay: 7}) + '%26toDate%3D' + getFormattedDate() + '%26hash%3D' + computeHash(body),
  	body, 
  	addHeaders({
  		'X-Requested-With': 'XMLHttpRequest',
  		'Content-Type': 'application/json',
  		Referer: 'http://www.sberbank.ru/ru/quotes/metal/'
  	}));

  var json = getJson(html);

  var result = {success: true};

  for(var key in json){
  	  var metal = json[key];
  	  var name = g_iso_to2letters[metal.isoCur];
      if(AnyBalance.isAvailable(name + '_buy'))
        result[name + '_buy'] = metal.rates[0].buyValue;
      if(AnyBalance.isAvailable(name + '_sell'))
        result[name + '_sell'] = metal.rates[0].sellValue;
      if(AnyBalance.isAvailable(name + '_weight') && (weight = getWeight(name)))
        result[name + '_weight'] = metal.rates[0].buyValue * weight;
      sumParam(metal.rates[0].activeFrom, result, 'date', null, null, null, aggregate_max);
  }

  AnyBalance.setResult(result);
}

function mainOld(){

  var prefs = AnyBalance.getPreferences();
  var baseurl = "http://data.sberbank.ru/";
  AnyBalance.setDefaultCharset('utf-8');

  var prefs = AnyBalance.getPreferences();

  // были изменены id регионов, поэтому сопоставляем старые (сохраненные в настройках) значения с новыми
  var region = findRegion(prefs.region).REGION_MNEMONIC;

  var html = AnyBalance.requestGet(baseurl + region + '/ru/quotes/metal/', g_headers);

  if (!html || AnyBalance.getLastStatusCode() > 400) {
    AnyBalance.trace(html);
    throw new AnyBalance.Error('Ошибка при подключении к сайту провайдера! Попробуйте обновить данные позже.');
  }

  var result = {success: true};

  getParam(html, result, 'date', /Время\s*?последнего\s*?изменения\s*?котировок\s*?:([\s\S]*?)\s*?</i, replaceTagsAndSpaces, parseDate);

  var tables = getElementsByClassName(html, 'table3_eggs4');
  if (!tables || !tables.length) {
    throw new AnyBalance.Error('Не удается найти котировки. Сайт изменен?.');
  }

  //Чтобы счетчики были получены независимо от включенности, добавим им два подчеркивания
  var colsDef = {
    __buy: {
      re: /Покупка/i
    },
    __sell: {
      re: /Продажа/i
    },
  };

  var info = [];
  processTable(tables[0], info, '', colsDef);
  if (info.length) {
    info[0].name = 'Au';
    info[1].name = 'Ag';
    info[2].name = 'Pt';
    info[3].name = 'Pd';
    info.forEach(function (metal) {
      var name = metal.name;
      var weight = undefined;
      if(AnyBalance.isAvailable(name + '_buy'))
        result[name + '_buy'] = metal.__buy;
      if(AnyBalance.isAvailable(name + '_sell'))
        result[name + '_sell'] = metal.__sell;
      if(AnyBalance.isAvailable(name + '_weight') && (weight = getWeight(name)))
        result[name + '_weight'] = metal.__buy * weight;
    });
  }

  AnyBalance.setResult(result);
}

function getWeight(metal){
	var prefs = AnyBalance.getPreferences();
	if(!prefs.weight)
		return undefined;
	if(/^[\d\s\.,]+$/.test(prefs.weight))
		return parseBalance(prefs.weight);
	var weight = getParam(prefs.weight, null, null, new RegExp(metal + '\s*:([^;a-z]*)', 'i'), null, parseBalance);
	return weight;
}

function findRegion(mnemonic){
  AnyBalance.trace('На входе регион: ' + mnemonic);
  if(!mnemonic) mnemonic = 'moscow';
  var allRegionsNew = ['moscow','saintpetersburg','adygea','altaikrai','amur','arkhangelsk','astrakhan','belgorod','bryansk','buryatia','vladimir','volgograd','vologda','voronezh','dagestan','jewish','zabaykalskykrai','ivanovo','ingushetia','irkutsk','kabardinobalkaria','kaliningrad','kalmykia','kaluga','kamchatka','karachaycherkessia','karelia','kemerovo','kirov','komi','kostroma','krasnodar','krasnoyarsk','kurgan','kursk','leningradoblast','lipetsk','magadan','mariel','mordovia','moscowoblast','murmansk','nenets','nizhnynovgorod','novgorod','novosibirsk','omsk','orenburg','oryol','penza','perm','primorskykrai','pskov','altai','bashkortostan','rostov','ryazan','samara','saratov','sakhalin','sverdlovsk','alania','smolensk','stavropol','tambov','tatarstan','tver','tomsk','tula','tuva','tyumen','udmurtia','ulyanovsk','khabarovsk','khakassia','khantymansi','chelyabinsk','chechnya','chuvashia','chukotka','sakha','yamalonenets','yaroslavl'];
  var allRegionsOld = ['223','246_1','281_2','201_3','271_4','235_5','224_6','275_7','259_8','203_9','206_10','225_11','236_12','276_13','256_14','270_15','204_16','237_17','256_18','205_19','256_20','246_21','256_22','260_23','231_24','256_25','246_26','248_27','207_28','220_29','238_30','282_31','213_32','266_33','277_34','246_35','278_36','232_37','208_38','209_39','261_40','246_41','239_42','210_43','246_44','249_45','217_46','226_47','279_48','227_49','221_50','272_51','246_52','201_53','267_54','283_55','262_56','228_57','229_58','273_59','268_60','256_61','263_62','257_63','280_64','211_65','264_66','250_67','265_68','214_69','217_70','220_71','230_72','274_73','215_74','217_75','269_76','256_77','212_78','233_79','234_80','217_81','240_82'];
  if (allRegionsNew.indexOf(mnemonic) < 0) {
    mnemonic = allRegionsNew[allRegionsOld.indexOf(mnemonic)];
  }
  if(!mnemonic) mnemonic = 'moscow';
  var region = findRegion1(mnemonic) || g_regions[0];
  AnyBalance.trace('Показываем регион ' + region.REGION_MNEMONIC);
  return region;
}

function findRegion1(mnemonic){
	for(var i=0; i<g_regions.length; ++i){
		var region = g_regions[i];
		if(region.REGION_MNEMONIC == mnemonic)
			return region;
	}
}

var g_regions = [
  {
    "REGION_ID": 77,
    "REGION_NAME_EN": "Moscow",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": " Москва",
    "ORDER_NUM": 1,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "moscow",
    "TRBANK_CODE": "038",
    "name": " Москва",
    "group": "F"
  },
  {
    "REGION_ID": 78,
    "REGION_NAME_EN": "St. Petersburg",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Санкт-Петербург",
    "ORDER_NUM": 2,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "saintpetersburg",
    "TRBANK_CODE": "055",
    "name": "Санкт-Петербург",
    "group": "F"
  },
  {
    "REGION_ID": 1,
    "REGION_NAME_EN": "Republic of Adygea",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Адыгея",
    "ORDER_NUM": 3,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "adygea",
    "FIRST_LETTER": "А",
    "TRBANK_CODE": "052",
    "name": "Республика Адыгея",
    "group": "А"
  },
  {
    "REGION_ID": 22,
    "REGION_NAME_EN": "Altai region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Алтайский край",
    "ORDER_NUM": 4,
    "TIME_ZONE": 3,
    "REGION_MNEMONIC": "altaikrai",
    "FIRST_LETTER": "А",
    "TRBANK_CODE": "044",
    "name": "Алтайский край",
    "group": "А"
  },
  {
    "REGION_ID": 28,
    "REGION_NAME_EN": "Amur region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Амурская область",
    "ORDER_NUM": 5,
    "TIME_ZONE": 6,
    "REGION_MNEMONIC": "amur",
    "FIRST_LETTER": "А",
    "TRBANK_CODE": "070",
    "name": "Амурская область",
    "group": "А"
  },
  {
    "REGION_ID": 29,
    "REGION_NAME_EN": "Arkhangelsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Архангельская область",
    "ORDER_NUM": 6,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "arkhangelsk",
    "FIRST_LETTER": "А",
    "TRBANK_CODE": "077",
    "name": "Архангельская область",
    "group": "А"
  },
  {
    "REGION_ID": 30,
    "REGION_NAME_EN": "Astrakhan region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Астраханская область",
    "ORDER_NUM": 7,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "astrakhan",
    "FIRST_LETTER": "А",
    "TRBANK_CODE": "054",
    "name": "Астраханская область",
    "group": "А"
  },
  {
    "REGION_ID": 31,
    "REGION_NAME_EN": "Belgorod region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Белгородская область",
    "ORDER_NUM": 8,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "belgorod",
    "FIRST_LETTER": "Б",
    "TRBANK_CODE": "013",
    "name": "Белгородская область",
    "group": "Б"
  },
  {
    "REGION_ID": 32,
    "REGION_NAME_EN": "Bryansk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Брянская область",
    "ORDER_NUM": 9,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "bryansk",
    "FIRST_LETTER": "Б",
    "TRBANK_CODE": "040",
    "name": "Брянская область",
    "group": "Б"
  },
  {
    "REGION_ID": 3,
    "REGION_NAME_EN": "The Republic of Buryatia",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Бурятия",
    "ORDER_NUM": 10,
    "TIME_ZONE": 5,
    "REGION_MNEMONIC": "buryatia",
    "FIRST_LETTER": "Б",
    "TRBANK_CODE": "018",
    "name": "Республика Бурятия",
    "group": "Б"
  },
  {
    "REGION_ID": 33,
    "REGION_NAME_EN": "Vladimir region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Владимирская область",
    "ORDER_NUM": 11,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "vladimir",
    "FIRST_LETTER": "В",
    "TRBANK_CODE": "042",
    "name": "Владимирская область",
    "group": "В"
  },
  {
    "REGION_ID": 34,
    "REGION_NAME_EN": "Volgograd region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Волгоградская область",
    "ORDER_NUM": 12,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "volgograd",
    "FIRST_LETTER": "В",
    "TRBANK_CODE": "054",
    "name": "Волгоградская область",
    "group": "В"
  },
  {
    "REGION_ID": 35,
    "REGION_NAME_EN": "Vologda region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Вологодская область",
    "ORDER_NUM": 13,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "vologda",
    "FIRST_LETTER": "В",
    "TRBANK_CODE": "077",
    "name": "Вологодская область",
    "group": "В"
  },
  {
    "REGION_ID": 36,
    "REGION_NAME_EN": "Voronezh region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Воронежская область",
    "ORDER_NUM": 14,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "voronezh",
    "FIRST_LETTER": "В",
    "TRBANK_CODE": "013",
    "name": "Воронежская область",
    "group": "В"
  },
  {
    "REGION_ID": 5,
    "REGION_NAME_EN": "The Republic of Dagestan",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Дагестан",
    "ORDER_NUM": 15,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "dagestan",
    "FIRST_LETTER": "Д",
    "TRBANK_CODE": "052",
    "name": "Республика Дагестан",
    "group": "Д"
  },
  {
    "REGION_ID": 79,
    "REGION_NAME_EN": "The Jewish Autonomous region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Еврейская автономная область",
    "ORDER_NUM": 16,
    "TIME_ZONE": 7,
    "REGION_MNEMONIC": "jewish",
    "FIRST_LETTER": "Е",
    "TRBANK_CODE": "070",
    "name": "Еврейская автономная область",
    "group": "Е"
  },
  {
    "REGION_ID": 75,
    "REGION_NAME_EN": "Transbaikalia Territory",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Забайкальский край",
    "ORDER_NUM": 17,
    "TIME_ZONE": 6,
    "REGION_MNEMONIC": "zabaykalskykrai",
    "FIRST_LETTER": "З",
    "TRBANK_CODE": "018",
    "name": "Забайкальский край",
    "group": "З"
  },
  {
    "REGION_ID": 37,
    "REGION_NAME_EN": "Ivanovo region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ивановская область",
    "ORDER_NUM": 18,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "ivanovo",
    "FIRST_LETTER": "И",
    "TRBANK_CODE": "077",
    "name": "Ивановская область",
    "group": "И"
  },
  {
    "REGION_ID": 6,
    "REGION_NAME_EN": "Republic of Ingushetia",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Ингушетия",
    "ORDER_NUM": 19,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "ingushetia",
    "FIRST_LETTER": "И",
    "TRBANK_CODE": "052",
    "name": "Республика Ингушетия",
    "group": "И"
  },
  {
    "REGION_ID": 38,
    "REGION_NAME_EN": "Irkutsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Иркутская область",
    "ORDER_NUM": 20,
    "TIME_ZONE": 5,
    "REGION_MNEMONIC": "irkutsk",
    "FIRST_LETTER": "И",
    "TRBANK_CODE": "018",
    "name": "Иркутская область",
    "group": "И"
  },
  {
    "REGION_ID": 7,
    "REGION_NAME_EN": "The Kabardino-Balkar Republic",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Кабардино-Балкарская Республика",
    "ORDER_NUM": 21,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "kabardinobalkaria",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "052",
    "name": "Кабардино-Балкарская Республика",
    "group": "К"
  },
  {
    "REGION_ID": 39,
    "REGION_NAME_EN": "Kaliningrad region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Калининградская область",
    "ORDER_NUM": 22,
    "TIME_ZONE": -1,
    "REGION_MNEMONIC": "kaliningrad",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "055",
    "name": "Калининградская область",
    "group": "К"
  },
  {
    "REGION_ID": 8,
    "REGION_NAME_EN": "The Republic of Kalmykia",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Калмыкия",
    "ORDER_NUM": 23,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "kalmykia",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "052",
    "name": "Республика Калмыкия",
    "group": "К"
  },
  {
    "REGION_ID": 40,
    "REGION_NAME_EN": "Kaluga region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Калужская область",
    "ORDER_NUM": 24,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "kaluga",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "040",
    "name": "Калужская область",
    "group": "К"
  },
  {
    "REGION_ID": 41,
    "REGION_NAME_EN": "Kamchatka region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Камчатский край",
    "ORDER_NUM": 25,
    "TIME_ZONE": 8,
    "REGION_MNEMONIC": "kamchatka",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "070",
    "name": "Камчатский край",
    "group": "К"
  },
  {
    "REGION_ID": 9,
    "REGION_NAME_EN": "Karachay-Cherkessia",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Карачаево-Черкесская Республика",
    "ORDER_NUM": 26,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "karachaycherkessia",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "052",
    "name": "Карачаево-Черкесская Республика",
    "group": "К"
  },
  {
    "REGION_ID": 10,
    "REGION_NAME_EN": "The Republic of Karelia",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Карелия",
    "ORDER_NUM": 27,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "karelia",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "055",
    "name": "Республика Карелия",
    "group": "К"
  },
  {
    "REGION_ID": 42,
    "REGION_NAME_EN": "Kemerovo region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Кемеровская область",
    "ORDER_NUM": 28,
    "TIME_ZONE": 3,
    "REGION_MNEMONIC": "kemerovo",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "044",
    "name": "Кемеровская область",
    "group": "К"
  },
  {
    "REGION_ID": 43,
    "REGION_NAME_EN": "Kirov region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Кировская область",
    "ORDER_NUM": 29,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "kirov",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "042",
    "name": "Кировская область",
    "group": "К"
  },
  {
    "REGION_ID": 11,
    "REGION_NAME_EN": "Komi Republic",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Коми",
    "ORDER_NUM": 30,
    "TIME_ZONE": 3,
    "REGION_MNEMONIC": "komi",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "049",
    "name": "Республика Коми",
    "group": "К"
  },
  {
    "REGION_ID": 44,
    "REGION_NAME_EN": "Kostroma region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Костромская область",
    "ORDER_NUM": 31,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "kostroma",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "077",
    "name": "Костромская область",
    "group": "К"
  },
  {
    "REGION_ID": 23,
    "REGION_NAME_EN": "Krasnodar region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Краснодарский край",
    "ORDER_NUM": 32,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "krasnodar",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "052",
    "name": "Краснодарский край",
    "group": "К"
  },
  {
    "REGION_ID": 24,
    "REGION_NAME_EN": "Krasnoyarsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Красноярский край",
    "ORDER_NUM": 33,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "krasnoyarsk",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "044",
    "name": "Красноярский край",
    "group": "К"
  },
  {
    "REGION_ID": 45,
    "REGION_NAME_EN": "Kurgan region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Курганская область",
    "ORDER_NUM": 34,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "kurgan",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "016",
    "name": "Курганская область",
    "group": "К"
  },
  {
    "REGION_ID": 46,
    "REGION_NAME_EN": "Kursk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Курская область",
    "ORDER_NUM": 35,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "kursk",
    "FIRST_LETTER": "К",
    "TRBANK_CODE": "013",
    "name": "Курская область",
    "group": "К"
  },
  {
    "REGION_ID": 47,
    "REGION_NAME_EN": "Leningrad region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ленинградская область",
    "ORDER_NUM": 36,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "leningradoblast",
    "FIRST_LETTER": "Л",
    "TRBANK_CODE": "055",
    "name": "Ленинградская область",
    "group": "Л"
  },
  {
    "REGION_ID": 48,
    "REGION_NAME_EN": "Lipetsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Липецкая область",
    "ORDER_NUM": 37,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "lipetsk",
    "FIRST_LETTER": "Л",
    "TRBANK_CODE": "013",
    "name": "Липецкая область",
    "group": "Л"
  },
  {
    "REGION_ID": 49,
    "REGION_NAME_EN": "Magadan region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Магаданская область",
    "ORDER_NUM": 38,
    "TIME_ZONE": 8,
    "REGION_MNEMONIC": "magadan",
    "FIRST_LETTER": "М",
    "TRBANK_CODE": "070",
    "name": "Магаданская область",
    "group": "М"
  },
  {
    "REGION_ID": 12,
    "REGION_NAME_EN": "Mari El Republic",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Марий Эл",
    "ORDER_NUM": 39,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "mariel",
    "FIRST_LETTER": "М",
    "TRBANK_CODE": "042",
    "name": "Республика Марий Эл",
    "group": "М"
  },
  {
    "REGION_ID": 13,
    "REGION_NAME_EN": "Republic of Mordovia",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Мордовия",
    "ORDER_NUM": 40,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "mordovia",
    "FIRST_LETTER": "М",
    "TRBANK_CODE": "042",
    "name": "Республика Мордовия",
    "group": "М"
  },
  {
    "REGION_ID": 50,
    "REGION_NAME_EN": "Moscow region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Московская область",
    "ORDER_NUM": 41,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "moscowoblast",
    "FIRST_LETTER": "М",
    "TRBANK_CODE": "040",
    "name": "Московская область",
    "group": "М"
  },
  {
    "REGION_ID": 51,
    "REGION_NAME_EN": "Murmansk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Мурманская область",
    "ORDER_NUM": 42,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "murmansk",
    "FIRST_LETTER": "М",
    "TRBANK_CODE": "055",
    "name": "Мурманская область",
    "group": "М"
  },
  {
    "REGION_ID": 83,
    "REGION_NAME_EN": "The Nenets Autonomous Area",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ненецкий автономный округ",
    "ORDER_NUM": 43,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "nenets",
    "FIRST_LETTER": "Н",
    "TRBANK_CODE": "077",
    "name": "Ненецкий автономный округ",
    "group": "Н"
  },
  {
    "REGION_ID": 52,
    "REGION_NAME_EN": "Nizhny Novgorod region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Нижегородская область",
    "ORDER_NUM": 44,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "nizhnynovgorod",
    "FIRST_LETTER": "Н",
    "TRBANK_CODE": "042",
    "name": "Нижегородская область",
    "group": "Н"
  },
  {
    "REGION_ID": 53,
    "REGION_NAME_EN": "Novgorod region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Новгородская область",
    "ORDER_NUM": 45,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "novgorod",
    "FIRST_LETTER": "Н",
    "TRBANK_CODE": "055",
    "name": "Новгородская область",
    "group": "Н"
  },
  {
    "REGION_ID": 54,
    "REGION_NAME_EN": "Novosibirsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Новосибирская область",
    "ORDER_NUM": 46,
    "TIME_ZONE": 3,
    "REGION_MNEMONIC": "novosibirsk",
    "FIRST_LETTER": "Н",
    "TRBANK_CODE": "044",
    "name": "Новосибирская область",
    "group": "Н"
  },
  {
    "REGION_ID": 55,
    "REGION_NAME_EN": "Omsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Омская область",
    "ORDER_NUM": 47,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "omsk",
    "FIRST_LETTER": "О",
    "TRBANK_CODE": "067",
    "name": "Омская область",
    "group": "О"
  },
  {
    "REGION_ID": 56,
    "REGION_NAME_EN": "Orenburg region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Оренбургская область",
    "ORDER_NUM": 48,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "orenburg",
    "FIRST_LETTER": "О",
    "TRBANK_CODE": "054",
    "name": "Оренбургская область",
    "group": "О"
  },
  {
    "REGION_ID": 57,
    "REGION_NAME_EN": "Orel region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Орловская область",
    "ORDER_NUM": 49,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "oryol",
    "FIRST_LETTER": "О",
    "TRBANK_CODE": "013",
    "name": "Орловская область",
    "group": "О"
  },
  {
    "REGION_ID": 58,
    "REGION_NAME_EN": "Penza region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Пензенская область",
    "ORDER_NUM": 50,
    "TIME_ZONE": 3,
    "REGION_MNEMONIC": "penza",
    "FIRST_LETTER": "П",
    "TRBANK_CODE": "054",
    "name": "Пензенская область",
    "group": "П"
  },
  {
    "REGION_ID": 59,
    "REGION_NAME_EN": "Perm region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Пермский край",
    "ORDER_NUM": 51,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "perm",
    "FIRST_LETTER": "П",
    "TRBANK_CODE": "049",
    "name": "Пермский край",
    "group": "П"
  },
  {
    "REGION_ID": 25,
    "REGION_NAME_EN": "Primorsky region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Приморский край",
    "ORDER_NUM": 52,
    "TIME_ZONE": 7,
    "REGION_MNEMONIC": "primorskykrai",
    "FIRST_LETTER": "П",
    "TRBANK_CODE": "070",
    "name": "Приморский край",
    "group": "П"
  },
  {
    "REGION_ID": 60,
    "REGION_NAME_EN": "Pskov region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Псковская область",
    "ORDER_NUM": 53,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "pskov",
    "FIRST_LETTER": "П",
    "TRBANK_CODE": "055",
    "name": "Псковская область",
    "group": "П"
  },
  {
    "REGION_ID": 4,
    "REGION_NAME_EN": "Altai Republic",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Алтай",
    "ORDER_NUM": 4,
    "TIME_ZONE": 3,
    "REGION_MNEMONIC": "altai",
    "FIRST_LETTER": "Р",
    "TRBANK_CODE": "044",
    "name": "Республика Алтай",
    "group": "Р"
  },
  {
    "REGION_ID": 2,
    "REGION_NAME_EN": "The Republic of Bashkortostan",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Башкортостан",
    "ORDER_NUM": 55,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "bashkortostan",
    "FIRST_LETTER": "Р",
    "TRBANK_CODE": "016",
    "name": "Республика Башкортостан",
    "group": "Р"
  },
  {
    "REGION_ID": 61,
    "REGION_NAME_EN": "Rostov region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ростовская область",
    "ORDER_NUM": 56,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "rostov",
    "FIRST_LETTER": "Р",
    "TRBANK_CODE": "052",
    "name": "Ростовская область",
    "group": "Р"
  },
  {
    "REGION_ID": 62,
    "REGION_NAME_EN": "Ryazan region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Рязанская область",
    "ORDER_NUM": 57,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "ryazan",
    "FIRST_LETTER": "Р",
    "TRBANK_CODE": "040",
    "name": "Рязанская область",
    "group": "Р"
  },
  {
    "REGION_ID": 63,
    "REGION_NAME_EN": "Samara region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Самарская область",
    "ORDER_NUM": 58,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "samara",
    "FIRST_LETTER": "С",
    "TRBANK_CODE": "054",
    "name": "Самарская область",
    "group": "С"
  },
  {
    "REGION_ID": 64,
    "REGION_NAME_EN": "Saratov region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Саратовская область",
    "ORDER_NUM": 59,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "saratov",
    "FIRST_LETTER": "С",
    "TRBANK_CODE": "054",
    "name": "Саратовская область",
    "group": "С"
  },
  {
    "REGION_ID": 65,
    "REGION_NAME_EN": "Sakhalin region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Сахалинская область",
    "ORDER_NUM": 60,
    "TIME_ZONE": 7,
    "REGION_MNEMONIC": "sakhalin",
    "FIRST_LETTER": "С",
    "TRBANK_CODE": "070",
    "name": "Сахалинская область",
    "group": "С"
  },
  {
    "REGION_ID": 66,
    "REGION_NAME_EN": "Sverdlovsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Свердловская область",
    "ORDER_NUM": 61,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "sverdlovsk",
    "FIRST_LETTER": "С",
    "TRBANK_CODE": "016",
    "name": "Свердловская область",
    "group": "С"
  },
  {
    "REGION_ID": 15,
    "REGION_NAME_EN": "Republic of North Ossetia - Alania",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Северная Осетия — Алания",
    "ORDER_NUM": 62,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "alania",
    "FIRST_LETTER": "С",
    "TRBANK_CODE": "052",
    "name": "Республика Северная Осетия — Алания",
    "group": "С"
  },
  {
    "REGION_ID": 67,
    "REGION_NAME_EN": "Smolensk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Смоленская область",
    "ORDER_NUM": 63,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "smolensk",
    "FIRST_LETTER": "С",
    "TRBANK_CODE": "040",
    "name": "Смоленская область",
    "group": "С"
  },
  {
    "REGION_ID": 26,
    "REGION_NAME_EN": "Stavropol region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ставропольский край ",
    "ORDER_NUM": 64,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "stavropol",
    "FIRST_LETTER": "С",
    "TRBANK_CODE": "052",
    "name": "Ставропольский край ",
    "group": "С"
  },
  {
    "REGION_ID": 68,
    "REGION_NAME_EN": "Tambov region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Тамбовская область",
    "ORDER_NUM": 65,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "tambov",
    "FIRST_LETTER": "Т",
    "TRBANK_CODE": "013",
    "name": "Тамбовская область",
    "group": "Т"
  },
  {
    "REGION_ID": 16,
    "REGION_NAME_EN": "The Republic of Tatarstan",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Татарстан",
    "ORDER_NUM": 66,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "tatarstan",
    "FIRST_LETTER": "Т",
    "TRBANK_CODE": "042",
    "name": "Республика Татарстан",
    "group": "Т"
  },
  {
    "REGION_ID": 69,
    "REGION_NAME_EN": "Tver region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Тверская область",
    "ORDER_NUM": 67,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "tver",
    "FIRST_LETTER": "Т",
    "TRBANK_CODE": "040",
    "name": "Тверская область",
    "group": "Т"
  },
  {
    "REGION_ID": 70,
    "REGION_NAME_EN": "Tomsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Томская область",
    "ORDER_NUM": 68,
    "TIME_ZONE": 3,
    "REGION_MNEMONIC": "tomsk",
    "FIRST_LETTER": "Т",
    "TRBANK_CODE": "044",
    "name": "Томская область",
    "group": "Т"
  },
  {
    "REGION_ID": 71,
    "REGION_NAME_EN": "Tula region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Тульская область",
    "ORDER_NUM": 69,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "tula",
    "FIRST_LETTER": "Т",
    "TRBANK_CODE": "040",
    "name": "Тульская область",
    "group": "Т"
  },
  {
    "REGION_ID": 17,
    "REGION_NAME_EN": "The Republic of Tyva",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Тыва",
    "ORDER_NUM": 70,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "tuva",
    "FIRST_LETTER": "Т",
    "TRBANK_CODE": "044",
    "name": "Республика Тыва",
    "group": "Т"
  },
  {
    "REGION_ID": 72,
    "REGION_NAME_EN": "Tyumen region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Тюменская область",
    "ORDER_NUM": 71,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "tyumen",
    "FIRST_LETTER": "Т",
    "TRBANK_CODE": "067",
    "name": "Тюменская область",
    "group": "Т"
  },
  {
    "REGION_ID": 18,
    "REGION_NAME_EN": "Udmurtia",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Удмуртская Республика",
    "ORDER_NUM": 72,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "udmurtia",
    "FIRST_LETTER": "У",
    "TRBANK_CODE": "049",
    "name": "Удмуртская Республика",
    "group": "У"
  },
  {
    "REGION_ID": 73,
    "REGION_NAME_EN": "Ulyanovsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ульяновская область",
    "ORDER_NUM": 73,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "ulyanovsk",
    "FIRST_LETTER": "У",
    "TRBANK_CODE": "054",
    "name": "Ульяновская область",
    "group": "У"
  },
  {
    "REGION_ID": 27,
    "REGION_NAME_EN": "Khabarovsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Хабаровский край ",
    "ORDER_NUM": 74,
    "TIME_ZONE": 7,
    "REGION_MNEMONIC": "khabarovsk",
    "FIRST_LETTER": "Х",
    "TRBANK_CODE": "070",
    "name": "Хабаровский край ",
    "group": "Х"
  },
  {
    "REGION_ID": 19,
    "REGION_NAME_EN": "The Republic of Khakassia",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Хакасия",
    "ORDER_NUM": 75,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "khakassia",
    "FIRST_LETTER": "Х",
    "TRBANK_CODE": "044",
    "name": "Республика Хакасия",
    "group": "Х"
  },
  {
    "REGION_ID": 86,
    "REGION_NAME_EN": "The Khanty-Mansi Autonomous Area - Yugra",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ханты-Мансийский автономный округ — Югра",
    "ORDER_NUM": 76,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "khantymansi",
    "FIRST_LETTER": "Х",
    "TRBANK_CODE": "067",
    "name": "Ханты-Мансийский автономный округ — Югра",
    "group": "Х"
  },
  {
    "REGION_ID": 74,
    "REGION_NAME_EN": "Chelyabinsk region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Челябинская область",
    "ORDER_NUM": 77,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "chelyabinsk",
    "FIRST_LETTER": "Ч",
    "TRBANK_CODE": "016",
    "name": "Челябинская область",
    "group": "Ч"
  },
  {
    "REGION_ID": 20,
    "REGION_NAME_EN": "The Chechen Republic",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Чеченская Республика",
    "ORDER_NUM": 78,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "chechnya",
    "FIRST_LETTER": "Ч",
    "TRBANK_CODE": "052",
    "name": "Чеченская Республика",
    "group": "Ч"
  },
  {
    "REGION_ID": 21,
    "REGION_NAME_EN": "The Chuvash Republic",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Чувашская Республика",
    "ORDER_NUM": 79,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "chuvashia",
    "FIRST_LETTER": "Ч",
    "TRBANK_CODE": "042",
    "name": "Чувашская Республика",
    "group": "Ч"
  },
  {
    "REGION_ID": 87,
    "REGION_NAME_EN": "The Chukotka Autonomous Area",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Чукотский автономный округ",
    "ORDER_NUM": 80,
    "TIME_ZONE": 8,
    "REGION_MNEMONIC": "chukotka",
    "FIRST_LETTER": "Ч",
    "TRBANK_CODE": "070",
    "name": "Чукотский автономный округ",
    "group": "Ч"
  },
  {
    "REGION_ID": 14,
    "REGION_NAME_EN": "The Republic of Sakha (Yakutia)",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Республика Саха (Якутия)",
    "ORDER_NUM": 81,
    "TIME_ZONE": 6,
    "REGION_MNEMONIC": "sakha",
    "FIRST_LETTER": "Я",
    "TRBANK_CODE": "018",
    "name": "Республика Саха (Якутия)",
    "group": "Я"
  },
  {
    "REGION_ID": 89,
    "REGION_NAME_EN": "The Yamal-Nenets Autonomous Area",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ямало-Ненецкий автономный округ",
    "ORDER_NUM": 82,
    "TIME_ZONE": 2,
    "REGION_MNEMONIC": "yamalonenets",
    "FIRST_LETTER": "Я",
    "TRBANK_CODE": "067",
    "name": "Ямало-Ненецкий автономный округ",
    "group": "Я"
  },
  {
    "REGION_ID": 76,
    "REGION_NAME_EN": "Yaroslavl region",
    "CREATED_DATE": 1409256000000,
    "REGION_NAME": "Ярославская область",
    "ORDER_NUM": 83,
    "TIME_ZONE": 0,
    "REGION_MNEMONIC": "yaroslavl",
    "FIRST_LETTER": "Я",
    "TRBANK_CODE": "077",
    "name": "Ярославская область",
    "group": "Я"
  }
];