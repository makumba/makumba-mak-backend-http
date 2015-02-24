//! makumba-angular.js
//! version: 0.1.0
//! authors: Filip Kis
//! license: MIT 

(function (window,document,undefined) {

	function Query(from){
		this.from = from;
		this.projections = [];

		this.addProjection = function(projection) {
			this.projections.push(projection);
		}

		this.addParent = function(query) {
			if(query !== undefined && query !== null)
				this.parent = query;
		}

		this.getParentIndex = function() {
			if(this.parent === undefined)
				return -1;
			return this.parent.getId();
		}

		this.getId = function() {
			return makumba.$$queries.$$array.indexOf(this);
		}

	}

	function Makumba(){

		this.$$queries = {};
		this.$$queries.$$array = [];
		this.$$annotated = false;

		this.getQuery = function(query) {
			if(this.$$queries[query]!==undefined) {
				return this.$$queries[query];
			}

			this.$$queries[query] = new Query(query);

			return this.$$queries[query];
		}

		this.getQueryString = function(element) {
			return element.attr("data-from");
		}

		this.getParentQuery = function(element) {
			var parents = angular.element(element).parents("[data-from]");
			if(parents.length === 0){
				return undefined;
			}
			var queryStr = $(parents[0]).attr("data-from");
			return makumba.getQuery(queryStr);
		}

		this.addToQueryArray = function(query) {
			this.$$queries.$$array.unshift(query);
		}

		this.getQueryRequest = function() {
			var result = [];
			for(var i=0; i<this.$$queries.$$array.length; i++) {
				var q = this.$$queries.$$array[i];
				var o = new Object();
				o.parentIndex = q.getParentIndex();
				o.from = q.from;
				o.projections = q.projections;
				result.push(o);
			}
			return result;
		}

		this.annotate = function(value){
			if(value) {
				this.$$annotated = true;
			} else {
				this.$$annotated = false;
			}
			this.apply();
		}

		this.apply = function() {
			angular.element(window.document.body).scope().$apply();
		}

		this.app = angular.module("Makumba",[]);

		this.app.directive("from", ['$rootScope','$interpolate', function($rootScope,$interpolate) {
			return {
				transclude: true,
				priority:1000,
				//replace: true,
				// template: '<!-- directive: ngRepeat i in [1,2] --> <div  ng-transclude> </div> <!-- /ng-repeat -->'
				scope:{},
				template: '<span ng-repeat="$$result in $parent.$$result[queryid]" ng-transclude></span>',
				controller: function($scope, $element, $attrs) {
					$scope.expr = function(value) {
						if($scope.$$result[value]===undefined){
							return $scope.$parent.expr(value);
						}
						return $scope.$$result[value];
					}
				},
				compile:function(tElement, tAttrs) {
					// tAttrs.$set("ngClass","{__makumba__list__annotation__:$root.annotated()}");
					//tAttrs.$set("class",$interpolate("a{{queryid}}"))
					var query = makumba.getQuery(makumba.getQueryString(tElement));
					makumba.addToQueryArray(query);
					query.addParent(makumba.getParentQuery(tElement));
					console.log(tAttrs.from);
					return function postLink(scope,element,attrs) {
						scope.queryid = makumba.getQuery(attrs.from).getId();
					}
				}
			}
		}]);

		this.app.directive("text", [function(){
			return{
				//transclude:'element',
				replace:false,
				template:"<span class='__makumba__field__annotation__' ng-if='$root.$$annotated()'>{{expr}}:</span>{{$parent.$$result[expr]}}",
				scope:{},
				compile: function(tElement, tAttrs) {
					// var template = "{{$parent.result[expr]}}"
					// if(makumba._annotated)
					// 	tElement.replaceWith('<span>{{expr}}:{{$parent.result[expr]}}');
					var query = makumba.getParentQuery(tElement);
					query.addProjection(tAttrs.text);
					console.log(tAttrs.text);
					return function postLink(scope,element,attrs) {
						scope.expr = attrs["text"];
					}
				}

			}
		}]);

		this.app.filter('show', function() {
  			return function(text,condition) {
   			 	if(!condition)
      				return; 
    			return text;
    		}
  		});

		this.app.run( function($rootScope) {
			$rootScope.$$makumba = makumba.queries;
			$rootScope.$$result = {};
			$rootScope.$$annotated = function(){
				return makumba.$$annotated;
			};
			//$rootScope.result = {"0":[{"s.name":"formativ","1":[{"q.nr":"1"},{"q.nr":"2"},{"q.nr":"3"},{"q.nr":"4"},{"q.nr":"5"},{"q.nr":"6"},{"q.nr":"7"}]},{"s.name":"summativ","1":[]}]};
		});
	}
	
	makumba = window.makumba = new Makumba();

}(window || this));

angular.element(document).ready(function() {
	//angular.bootstrap(document, ['Makumba']);
	$.ajax({
	  url: "http://localhost:8080/mak-js-server/MakumbaQueryServlet",
	  // contentType:"application/json",
      type:"post",
	  data: {queries:JSON.stringify(makumba.getQueryRequest())}
	})
	  .done(function( msg ) {
	    console.log(msg);
	  	angular.element(document.body).scope().$$result = msg;
	  	angular.element(document.body).scope().$apply();
	  }).fail(function(xhr,status,error) {
		angular.element(document.body).scope().$$error = xhr.responseJSON.error;
		angular.element(document.body).scope().$apply();
	  });
});