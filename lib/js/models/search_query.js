(function() {

var $ = jQuery; // Handle namespaced jQuery

// Collection which holds all of the individual facets (category: value).
// Used for finding and removing specific facets.
VS.model.SearchQuery = Backbone.Collection.extend({

  // Model holds the category and value of the facet.
  model : VS.model.SearchFacet,

  // Turns all of the facets into a single serialized string.
  value : function() {
    return this.map(function(facet){ return facet.serialize(); }).join(' ');
  },

  // Find a facet by its category. Multiple facets with the same category
  // is fine, but only the first is returned.
  find : function(category) {
    var facet = this.detect(function(facet) {
      return facet.get('category') == category;
    });
    return facet && facet.get('value');
  },

  // Counts the number of times a specific category is in the search query.
  count : function(category) {
    return this.select(function(facet) {
      return facet.get('category') == category;
    }).length;
  },

  // Returns an array of extracted values from each facet in a category.
  values : function(category) {
    var facets = this.select(function(facet) {
      return facet.get('category') == category;
    });
    return _.map(facets, function(facet) { return facet.get('value'); });
  },

  // Checks all facets for matches of either a category or both category and value.
  has : function(category, value) {
    return this.any(function(facet) {
      var categoryMatched = facet.get('category') == category;
      if (!value) return categoryMatched;
      return categoryMatched && facet.get('value') == value;
    });
  },

  // Used to temporarily hide a specific category and serialize the search query.
  withoutCategory : function(category) {
    return this.map(function(facet) {
      if (facet.get('category') != category) return facet.serialize();
    }).join(' ');
  },

  // Returns an object of all facet category:value mappings in the collection.
  valueObj : function() {
    return this.reduce(function(memo, facet) {
      memo[facet.get('category')] = facet.get('value');
      return memo;
    }, {});
  }

});

})();