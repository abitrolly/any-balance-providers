﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
	'Cache-Control': 'max-age=0',
	'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36',
	'Accept-Language':'ru,en;q=0.8',
	'Connection':'keep-alive',
};

function main() {
	var prefs = AnyBalance.getPreferences();
	var baseurl = 'http://www.bloomberg.com/';
	
	AnyBalance.setDefaultCharset('utf-8');
	
	checkEmpty(prefs.quote, 'Please, enter quote!');

	var html = AnyBalance.requestGet(baseurl + 'apps/data?pid=symautocomplete&Query='+prefs.quote, g_headers);
	
	var href = getParam(html, null, null, /Symbols\s*<\s*\/\s*a>(?:[^>]*>){4}[^>]*href=(?:"|')\/([^("')]*)/i);
	if(!href) {
		AnyBalance.trace(html);
		throw new AnyBalance.Error('Please check entered quote. The quote ' + prefs.quote + ' has not been found!');
	}
	
	html = AnyBalance.requestGet(baseurl + href, g_headers);
	
	var header = getElement(html, /<div[^>]*class="basic-quote"[^>]*>/i);
	if(!header) {
		AnyBalance.trace(html);
		throw new AnyBalance.Error('Please check entered quote. The quote header ' + prefs.quote + ' has not been found!');
	}
	
	var result = {success: true};
	
	getParam(href, result, 'quote', /quote\/(.*)/i, null, html_entity_decode);
	getParam(header, result, '__tariff', /<h1[^>]*>([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(header, result, 'quote_show', /<h1[^>]*>([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(header, result, 'balance', /class\s*=\s*"price"[^>]*>([\s\d.,]+)/i, replaceTagsAndSpaces, parseBalance);
	getParam(header, result, ['currency', 'balance', 'trending'], /class\s*=\s*"currency"[^>]*>([^<]+)/i);
	getParam(header, result, 'trending_pcts', /class\s*=\s*"\s*trending_[^>]*>[^>]*>([^<]*)/i, replaceTagsAndSpaces, parseBalance);	
	
	var i = getParam(header, null, null, /class\s*=\s*"\s*trending_down[^>]*>([\s\S]*?)</i, replaceTagsAndSpaces, parseBalance);
	if(i) {
		result.trending = i*-1;
	} else {
		getParam(header, result, 'trending', /class\s*=\s*"\s*trending_up[^>]*>([\s\S]*?)</i, replaceTagsAndSpaces, parseBalance);
	}
	getParam(html, result, 'open', />\s*Open(?:[^>]*>){2}([\s\d.,-]+)/i, replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'volume', />\s*Volume(?:[^>]*>){2}([\s\d.,-]+)/i, [/\D/g, ''], parseBalance);
	getParam(html, result, 'prev_close', />\s*Previous\s+Close(?:[^>]*>){2}([\s\d.,-]+)/i, replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'days_range', />\s*Day[^>]*Range(?:[^>]*>){2}([\s\d.,-]+)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, '52w_range', />\s*52wk Range(?:[^>]*>){2}([\s\d.,-]+)/i, replaceTagsAndSpaces, html_entity_decode);
	
    AnyBalance.setResult(result);
}