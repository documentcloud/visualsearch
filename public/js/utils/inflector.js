// Naive English transformations on words.
VS.utils.inflector = {

  small : "(a|an|and|as|at|but|by|en|for|if|in|of|on|or|the|to|v[.]?|via|vs[.]?)",
	punct : "([!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]*)",
	
  // Only works for words that pluralize by adding an 's', end in a 'y', or
  // that we've special-cased. Not comprehensive.
  pluralize : function(s, count) {
    if (count == 1) return s;
    if (s == 'this') return 'these';
    if (s == 'person') return 'people';
    if (s == 'this') return 'these';
    if (s.match(/y$/i)) return s.replace(/y$/i, 'ies');
    return s + 's';
  },
  
  // Titleize function by John Resig after John Gruber. MIT Licensed.
	titleize : function(s) {
	  s = s.replace(/[-.\/_]/g, ' ').replace(/\s+/gm, ' ');
	  var cap = this.capitalize;
		var parts = [], split = /[:.;?!] |(?: |^)["Ò]/g, index = 0;
		while (true) {
			var m = split.exec(s);
			parts.push( s.substring(index, m ? m.index : s.length)
				.replace(/\b([A-Za-z][a-z.'Õ]*)\b/g, function(all){
					return (/[A-Za-z]\.[A-Za-z]/).test(all) ? all : cap(all);
				})
				.replace(RegExp("\\b" + this.small + "\\b", "ig"), this.lowercase)
				.replace(RegExp("^" + this.punct + this.small + "\\b", "ig"), function(all, punct, word) {
					return punct + cap(word);
				})
				.replace(RegExp("\\b" + this.small + this.punct + "$", "ig"), cap));
			index = split.lastIndex;
			if ( m ) parts.push( m[0] );
			else break;
		}
		return parts.join("").replace(/ V(s?)\. /ig, " v$1. ")
			.replace(/(['Õ])S\b/ig, "$1s")
			.replace(/\b(AT&T|Q&A)\b/ig, function(all){
				return all.toUpperCase();
			});
	},

  // Delegate to the ECMA5 String.prototype.trim function, if available.
  trim : function(s) {
    return s.trim ? s.trim() : s.replace(/^\s+|\s+$/g, '');
  },

  truncate : function(s, length, truncation) {
    length = length || 30;
    truncation = truncation == null ? '...' : truncation;
    return s.length > length ? s.slice(0, length - truncation.length) + truncation : s;
  },
  
  escapeRegExp : function(s) {
    return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
  }
};