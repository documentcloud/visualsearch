// A parallel partial JS implementation of lib/dc/search/parser.rb
// Used to extract keywords from the free text search.
dc.app.SearchParser = {

  ALL_FIELDS        : /('.+?'|".+?"|[^'"\s]{2}\S*):\s*('.+?'|".+?"|[^'"\s]{2}\S*)/g,
  // ALL_FIELDS        : /\w+:\s?(('.+?'|".+?")|([^'"]{2}\S*))/g,
  
  FIELD             : /(.+?):\s*/,
  
  ONE_ENTITY        : /(city|country|term|state|person|place|organization|email|phone):\s*(([^'"][^'"]\S*)|'(.+?)'|"(.+?)")/i,

  ALL_ENTITIES      : /(city|country|term|state|person|place|organization|email|phone):\s*(([^'"][^'"]\S*)|'(.+?)'|"(.+?)")/ig,

  parse : function(query) {
    var searchFacets = this.extractAllFacets(query);
    SearchQuery.refresh(searchFacets);
  },
  
  extractAllFacets : function(query) {
    var facets = [];
    var originalQuery = query;
    
    while (query) {
      var category, value;
      originalQuery = query;
      var field = this.extractNextField(query);
      if (!field) {
        category = 'text';
        value    = this.extractSearchText(query);
        query    = dc.inflector.trim(query.replace(value, ''));
      } else if (field.indexOf(':') != -1) {
        category = field.match(this.FIELD)[1];
        value    = field.replace(this.FIELD, '').replace(/(^['"]|['"]$)/g, '');
        query    = dc.inflector.trim(query.replace(field, ''));
      } else if (field.indexOf(':') == -1) {
        category = 'text';
        value    = field;
        query    = dc.inflector.trim(query.replace(value, ''));
      }
      // console.log(['extractAllFacets', query, category, value, field]);
      if (category && value) {
          var searchFacet = new dc.model.SearchFacet({
            category : category,
            value    : dc.inflector.trim(value)
          });
          facets.push(searchFacet);
      }
      if (originalQuery == query) break;
    }
    
    return facets;
  },
  
  extractNextField : function(query) {
    var textRe = /^\s*(\S+)\s+(?=\w+:\s?(('.+?'|".+?")|([^'"]{2}\S*)))/;
    var textMatch = query.match(textRe);
    console.log(['extractNextField', query, textMatch]);
    if (textMatch && textMatch.length >= 1) {
      return textMatch[1];
    } else {
      return this.extractFirstField(query);
    }
  },
  
  extractFirstField : function(query) {
    var fields = query.match(this.ALL_FIELDS);
    return fields && fields.length && fields[0];
  },
  
  extractSearchText : function(query) {
    query = query || '';
    var text = dc.inflector.trim(query.replace(this.ALL_FIELDS, ''));
    console.log(['extractSearchText', query, text]);
    return text;
  },

  extractEntities : function(query) {
    var all = this.ALL_ENTITIES, one = this.ONE_ENTITY;
    var entities = query.match(all) || [];
    return _.sortBy(_.map(entities, function(ent){
      var match = ent.match(one);
      return {type : match[1], value : match[3] || match[4] || match[5]};
    }), function(ent) {
      return ent.value.toLowerCase();
    }).reverse();
  }

};