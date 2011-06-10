dc.model.SearchFacet = Backbone.Model.extend({
  
  UNQUOTABLE_CATEGORIES : [
    'text',
    'account',
    'document',
    'filter',
    'group',
    'access',
    'related',
    'projectid'
  ],
    
  serialize : function() {
    var category = this.get('category');
    var value    = dc.inflector.trim(this.get('value'));
    
    if (!value) return '';
    
    if (!_.contains(this.UNQUOTABLE_CATEGORIES, category)) value = '"' + value + '"';
    
    if (category != 'text') {
      category = category + ': ';
    } else {
      category = "";
    }
    
    return category + value;
  }
  
});