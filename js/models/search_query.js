dc.model.SearchQuery = Backbone.Collection.extend({
  
  model : dc.model.SearchFacet,
  
  value : function() {
    return this.map(function(facet) {
      return facet.serialize();
    }).join(' ');
  },
  
  find : function(category) {
    var facet = this.detect(function(facet) {
      return facet.get('category') == category;
    });
    return facet && facet.get('value');
  },
  
  count : function(category) {
    return this.select(function(facet) {
      return facet.get('category') == category;
    }).length;
  },
  
  values : function(category) {
    var facets = this.select(function(facet) {
      return facet.get('category') == category;
    });
    return _.map(facets, function(facet) { return facet.get('value'); });
  },
  
  has : function(category, value) {
    return this.any(function(facet) {
      if (value) {
        return facet.get('category') == category && facet.get('value') == value;
      } else {
        return facet.get('category') == category;
      }
    });
  },
  
  searchType : function() {
    var single   = false;
    var multiple = false;
    
    this.each(function(facet) {
      var category = facet.get('category');
      var value    = facet.get('value');
      
      if (value) {
        if (!single && !multiple) {
          single = category;
        } else {
          multiple = true;
          single = false;
        }
      }
    });

    if (single == 'filter') {
      return this.get('value');
    } else if (single == 'projectid') {
      return 'project';
    } else if (_.contains(['project', 'group', 'account'], single)) {
      return single;
    } else if (!single && !multiple) {
      return 'all';
    }
    
    return 'search';
  },
  
  withoutCategory : function(category) {
    var query = this.map(function(facet) {
      if (facet.get('category') != category) return facet.serialize();
    }).join(' ');
    
    return query;
  }
    
});

window.SearchQuery = new dc.model.SearchQuery();