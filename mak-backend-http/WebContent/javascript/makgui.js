	function RenderingManager(tMgr, ajaxRoot, log){
    	this.tMgr=tMgr;
    	this.log=log;
    	
    	this.annotated=false;
    	this.dataOn=null;
    	this.event=null;
    	this.ajaxRoot=ajaxRoot;
    }

	RenderingManager.prototype.isAnnotated=function (){
		return this.annotated;
	};


	RenderingManager.prototype.isDataOn=function () {
		return this.dataOn;
	};

	RenderingManager.prototype.getEvent=function() {
		return this.event;
	};

	RenderingManager.prototype.setAnnotated=function(anno, root) {
		if (this.annotated != anno) {
			var messed = this.dataOn;

			if (messed) {
				this.setDataOn(false, root);
			}
			this.event = anno ? "annoOn" : "annoOff";
			this.annotated = anno;
			this.render(root);
			if (messed) {
				this.setDataOn(true, root);
			}

		}
		this.event = null;
	};

	RenderingManager.prototype.setDataOn=function(b, root) {
		if (this.dataOn != b) {
			this.event = b ? "dataOn" : "dataOff";
			this.dataOn = b;
			this.render(root);
		}
		this.event = null;
	};

	RenderingManager.prototype.update=function(root) {
		this.event = "dataOn";
		this.render(root);
		this.event = null;
	};

	RenderingManager.prototype.update=function(root, object, path, value) {
// TODO: use ajax:		
		this.srv.update(object, path, value);
		this.update(root);
	};

	RenderingManager.prototype.render=function(node) {
		if (this.tMgr.isQueryAnnotatedWidget(node)) {			
			this.setProperties(node);
			this.renderAnnotatedWidget(node);
			this.renderChildren(node);
		} else if (this.tMgr.isIterationNode(node)) {
			this.renderIterationNode(node);
		} else
			this.renderChildren(node);
	};

	RenderingManager.prototype.setProperties=function(node) {
		var np = this.tMgr.getNodeProperties(node);
		for (var prop in np.getProperties()) {			
			var expr = np.props[prop];
			var param = np.examples[expr];
			
			// TODO: the type doesn't matter for javascript
			if(prop=='text' && param==null)
				param="";
			this.setProperty(node, prop, null, param);
		}
	};

	RenderingManager.prototype.renderAnnotatedWidget=function(node){};

	RenderingManager.prototype.renderChildren=function(container) {
		for (var i = 0; i < this.tMgr.getChildrenCount(container); i++) {
			this.render(this.tMgr.getChildAt(container, i));
		}
	};

	RenderingManager.prototype.renderIterationNode= function(node) {
		var base = -1;
		var parentNode = this.tMgr.findParentIterationNode(node);
		if (parentNode == null) {
			base = Date.now();
			// analysis, deep recursion
			this.findExpressionsInChildren(node);
			this.log("-- expressions: "
					+ (Date.now() - base));
		}
		// for the non-root queries, this will just point to the parent results:
		this.tMgr.getIterationData(node).executeQuery(!this.dataOn, this.ajaxRoot);

		if (parentNode == null) {
			this.log("-- " + (this.dataOn ? "data" : "analysis") + ": "
					+ (Date.now() - base));
		}
		// then the expression types are available
		if ("dataOn"==this.event) {
			this.iterateComponents(node);
		} else {
			if ("dataOff"==this.event) {
				this.restoreSavedChildren(node);
			}
		}
		this.renderBorder(node);
		if (!"dataOn"==this.event)
			this.renderChildren(node);
		if (this.annotated)
			this.renderAnnotations(node);
	};
	
	RenderingManager.prototype.renderAnnotations=function(node){};

	RenderingManager.prototype.renderBorder=function(node){};

	RenderingManager.prototype.iterateComponents=function(container) {
		// remove all children since we may have 0 iterations
		this.tMgr.removeAllChildren(container);

		// this will not do much since iteration nodes don't currently have node
		// properties
		this.setProperties(container);

		var l = Date.now();
		var iterationData = this.tMgr.getIterationData(container);

		// the usual iterationData loop
		if (iterationData.startIteration()) {
			for (var i = 0; i < iterationData.iterationSize(); i++) {
				iterationData.setRowIndex(i);
				// we take the children saved since we've removed all elements
				var len=this.tMgr.getSavedChildren(container).length;
				for (var j=0;j<len;j++) {
					var c= this.tMgr.getSavedChildren(container)[j];
					var comp = this.duplicateTree(c, iterationData);
					this.tMgr.add(container, comp);

					// this triggers the looping (iterateComponents()) of all
					// iterationNodes in the subtree
					this.render(comp);
				}
			}
			var end = Date.now();
			this.log("rendering: "+ (end - l)+ " "+ this.tMgr.getNodeProperties(container).getQueryData());

			// end of iteration
			iterationData.closeIteration();
		}
	};

	/* analysis, execution */
	
	RenderingManager.prototype.visitNodeForExpressions = function(node, np){
		for (var s in np.props) {
			this.tMgr.getIterationData(node).addExpression(np.props[s],
					np.canBeInvalidF(np.props[s]), np.isEditable(np.props[s]));
		}
	};

	RenderingManager.prototype.findExpressionsInChildren=function(node) {
		this.visitExpressions(node);
	};
	RenderingManager.prototype.visitExpressions=function( node) {
		var len= this.tMgr.getSavedChildren(node).length;
		for (var i=0; i<len; i++) {
			this.findExpressionsIn(node, this.tMgr.getSavedChildren(node)[i]);
		}
	};

	RenderingManager.prototype.findExpressionsIn=function(node, component) {
		if (this.tMgr.isIterationNode(component)) {
			this.visitNodeForExpressions(node, this.tMgr.getNodeProperties(component));
			this.findExpressionsInChildren(component);
			return;
		}
		if (this.tMgr.isQueryAnnotatedWidget(component)) {
			this.visitNodeForExpressions(node, this.tMgr.getNodeProperties(component));
			// return;
		}
		for (var i = 0; i < this.tMgr.getChildrenCount(component); i++) {
			this.findExpressionsIn(node, this.tMgr.getChildAt(component, i));
		}
	};

	/* duplication */
	RenderingManager.prototype.duplicateTree=function( template, iterationData) {
		var ret = this.tMgr.duplicateNode(template);
		if (this.tMgr.isIterationNode(template)) {
			this.tMgr.copyNodeRelations(template, ret);
			this.tMgr.setNodeProperties(ret, this.tMgr.getNodeProperties(template)
					.duplicateOn(iterationData));
			this.tMgr.setIterationData(ret, this.tMgr.getIterationData(template));

			// we don't propagate duplication further, the iteration node will
			// duplicate its children when it renders
			return ret;
		}

		if (this.tMgr.isQueryAnnotatedWidget(template)) {
			this.tMgr.setNodeProperties(ret, this.tMgr.getNodeProperties(template)
					.duplicateOn(iterationData));
		}

		for (var i = 0; i < this.tMgr.getChildrenCount(template); i++)
			this.tMgr.add(ret,
					this.duplicateTree(this.tMgr.getChildAt(template, i), iterationData));
		return ret;
	};

	RenderingManager.prototype.restoreSavedChildren=function ( node) {
		this.tMgr.removeAllChildren(node);

		var len= this.tMgr.getSavedChildren(node).length;
		for (var i=0; i<len;i++) {
			this.tMgr.add(node, this.tMgr.getSavedChildren(node)[i]);
		}
	};

	RenderingManager.prototype.setProperty=function(node, prop, type, param) {
		if ("text"==prop) {
			if (this.tMgr.getChildrenCount(node) > 0
					&& (this.tMgr.getChildAt(node, 0).nodeType==3)) {
				node.childNodes.item(0).nodeValue="" + param;
			}
		} else
			node.setAttribute(prop, param);

	};

//-------------------------------------------------------
	function TreeManager() {
	}
	
	TreeManager.prototype.getParent=function(c){
		return c.parentNode;
	};


	TreeManager.prototype.getChildrenCount=function(container){
		return container.childNodes.length;
	};

	TreeManager.prototype.getChildAt=function(container, i){
		return container.childNodes.item(i);
	};

	TreeManager.prototype.removeAllChildren=function(container){
		var childNodes = container.childNodes;
		var length = childNodes.length;
		for (var i = 0; i < length; i++) {
			container.removeChild(childNodes.item(0));
		}
	};

	TreeManager.prototype.add=function( container,  comp){
		container.appendChild(comp);		
	};

	TreeManager.prototype.duplicateNode=function(from) {
		return from.cloneNode(false);
	};


	TreeManager.prototype.getSavedChildren=function( container) {

		var arr = container.savedChildren;
		if (arr == undefined) {
			arr = [];
			container.savedChildren= arr;
			for (var i = 0; i < this.getChildrenCount(container); i++){
				arr.push(this.getChildAt(container, i));
			}
		}
		return arr;
	};
	TreeManager.prototype.copyNodeRelations=function(from, to) {
		to.savedChildren= from.savedChildren;
		to.parentHolder= from.parentHolder;
	};

	TreeManager.prototype.findParentIterationNode=function(node) {
		var value = node.parentHolder;
		if (value==undefined){
			var c = this.getParent(node);
			while (c != null && !this.isIterationNode(c)) {
				c = this.getParent(c);
			}

			value = c;
			if(value==null)
				value="";
			node.parentHolder= value;
		}
		if(value=="")
			value=null;
		return value;

	};


	TreeManager.prototype.getNodeProperties=function( node) {
		var props = node.nodeProps;
		if (props == undefined) {
			props = this.makeNodeProperties();
			node.nodeProps= props;
		}
		return props;
	};

	TreeManager.prototype.setNodeProperties=function( node,  val) {
		node.nodeProps= val;
	};

	TreeManager.prototype.isIterationNode=function( c) {
		return c.nodeType==1 && c.nodeProps != undefined && c.nodeProps.getQueryData() != null;
	};

	TreeManager.prototype.isQueryAnnotatedWidget=function(c) {
		return c.nodeType==1 && c.nodeProps != undefined && c.nodeProps.getQueryData() == null;
	};


	TreeManager.prototype.setIterationData=function(node, data) {
		node.iterationData =data;
	};

	TreeManager.prototype.getIterationData=function(node) {
		var dt =node.iterationData;

		if (dt == undefined) {
			var w = this.findParentIterationNode(node);
			var parentData = null;
			if (w != null){
				parentData = this.getIterationData(w);
			}
			dt = new ClientIterationData(parentData, this.getNodeProperties(node).getQueryData(), 0, -1);
			node.iterationData= dt;
		}
		return dt;
	};

	TreeManager.prototype.exploreTree=function(w) {
		var np = this.extractNodeProperties(w);
		if (np != null) {
			w.nodeProps=np;
		}
		if (this.isIterationNode(w)) {
			this.findParentIterationNode(w);
			this.getSavedChildren(w);
		}
		for (var i = 0; i < this.getChildrenCount(w); i++)
			this.exploreTree(this.getChildAt(w, i));
	};
	
	TreeManager.prototype.extractNodeProperties=function(node){
		if(node.nodeType!=1)
			return null;
		var attributes = node.attributes;
		if (attributes != null) {
			var np = new NodeProperties();
			var hasContent = false;

			if (getAttribute(attributes, "data-from") != null) {
				np.setQueryData([getAttribute(attributes, "data-from"), getAttribute(attributes, "data-where"), getAttribute(attributes, "data-groupBy"), getAttribute(attributes, "data-orderBy"), null, null]);
				// TODO: currently we don't allow iteration nodes to have
				// properties set, though this could be the case, using
				// expressions from enclosing queries
				hasContent = true;

			} else
				for (var i = 0; i < attributes.length; i++) {
					var n = attributes.item(i);

					// everything that starts with data is considerd a mak
					// expression
					if (n.nodeName.substring(0, 5)!="data-")
						continue;
					hasContent = true;

					var name = n.nodeName.substring(5);

					// if the parameter without data is present, it is
					// considered an example value
					var example = getAttribute(attributes, name);

					// ... and the text example is considered to be the first
					// Text subnode
					if (name=="text") {
						if (this.getChildrenCount(node) > 0 && this.getChildAt(node, 0).nodeType==3) {
							example = this.getChildAt(node, 0).nodeValue;
						}
					}

					np.addProperty(name, n.value, example);
				}
			if (!hasContent)
				return null;			

			return np;
		}
		return null;

	};
	
	function getAttribute( attr,  name) {
		var nd = attr.getNamedItem(name);
		if (nd == null)
			return null;
		return nd.value;
	}	
	
	

	function NodeProperties(){
		this.props=[];
		this.examples=[];
		this.editable=[];
		this.canBeInvalid=[];
		
	}
	NodeProperties.prototype.toString=function() {
		var ret="";
		if (this.getQueryData() != null)
			ret+=this.getQueryData();
		ret+=this.props;
		ret+="Ex";
		ret+=this.examples;
		return ret;
	};

	NodeProperties.prototype.addProperty=function( prop,  val,  example) {
		this.props[prop]= val;
		this.examples[val]= example;
	};

	NodeProperties.prototype.addProperty=function( prop, val,  example, edit) {
		this.props[prop]= val;
		this.examples[val]= example;
		this.editable[val]=edit;
	};

	NodeProperties.prototype.addExample=function( val,  example) {
		this.props[val]= example;
	};

	NodeProperties.prototype.getProperty=function(name) {
		return this.props[name];
	};

	NodeProperties.prototype.getProperties=function(){
		return this.props;
	};

	NodeProperties.prototype.getExamples=function() {
		return this.examples;
	};

//	public String htmlDebug() {
//		StringBuffer sb = new StringBuffer("<html><font face=\"sansserif\" >");
//		for (String prop : props.keySet())
//			sb.append(prop.startsWith("__") ? prop.substring(2) : prop)
//					.append(" ( ").append("<font color=red>")
//					.append(props.get(prop)).append("</font>").append(" ) ")
//					// .append(examples.get(props.get(prop)) != null ? "e.g. "
//					// + examples.get(props.get(prop)) : "")
//					.append("<br>");
//		sb.append("</font></html>");
//		return sb.toString();
//	}

	NodeProperties.prototype.duplicateOn=function( iterationData) {
		var ret = new NodeProperties();
		ret.props = this.props;
		ret.queryData = this.queryData;

		ret.examples = [];

		for (var prop in this.props) {
			var expr = this.props[prop];
			ret.examples[expr]= iterationData.getExpressionValue(expr);
		}
		return ret;
	};

	NodeProperties.prototype.canBeInvalidF=function( expr) {
		var b = this.canBeInvalid[expr];
		if (b == null)
			return false;
		return b;
	};

	NodeProperties.prototype.isEditable=function( expr) {
		var b = this.editable[expr];
		if (b == null)
			return false;
		return b;
	};

	NodeProperties.prototype.getQueryData=function() {
		return this.queryData;
	};

	NodeProperties.prototype.setQueryData=function(strings) {
		this.queryData = strings;
	};
	
//---------------
	
	function ClientIterationData(parent, qData, offset, limit){
		this.parent= parent;
		
		if (parent == null) {
			this.rootRequest = new Object();
			this.rootRequest.queries=[];
			this.parentQuery = -1;
		} else {
			this.rootRequest = parent.rootRequest;
			this.parentQuery = parent.queryIndex;
		}
		this.queryData = new Object();
		this.queryData.querySections=qData;
		this.queryData.projections=[];
		this.queryData.offset=offset;
		this.queryData.limit=limit;
		this.queryData.parentIndex=this.parentQuery;
		
		this.rootRequest.queries.push(this.queryData);
		this.queryIndex = this.rootRequest.queries.length-1;
	};
	
	ClientIterationData.prototype.getCurrentResult = function() {
			try {
				if (this.parent == null) {
					return this.rootResponse.resultData[this.queryIndex];
				}
				return this.parent.getCurrentResult()[this.parent.currentIndex][this.queryIndex];
			} catch (e) {
				return null;
			}
		};
		
	ClientIterationData.prototype.startIteration=function() {
			this.currentIndex = 0;
			this.iterationGroupData = this.getCurrentResult();
			if (this.iterationGroupData == null) {
				return false;
			}
			return true;
		};
		
	ClientIterationData.prototype.getAnalysis=function() {
			return this.rootResponse.results[this.queryIndex];
		};

	ClientIterationData.prototype.getRowWidth=function() {
			return this.getAnalysis().columnType.length;
		};

	ClientIterationData.prototype.setRowIndex=function(rowIndex) {
			this.currentIndex = rowIndex;
			this.currentData = this.iterationGroupData[this.currentIndex];
		};

	ClientIterationData.prototype.iterationSize=function() {
			if (this.iterationGroupData == null)
				return 0;
			return this.iterationGroupData.length;
		};

	ClientIterationData.prototype.closeIteration= function() {
			this.iterationGroupData = null;
			this.currentIndex = -1;
		};

	ClientIterationData.prototype.executeQuery=function( analyzeOnly, ajaxRoot) {
			this.editedLabels = [];

			if (this.parent == null) {
				var xmlhttp=new XMLHttpRequest();
				xmlhttp.open("POST", ajaxRoot, false);
				xmlhttp.send("request="+encodeURIComponent(JSON.stringify(this.rootRequest))+"&analyzeOnly="+analyzeOnly);				
				this.rootResponse = JSON.parse(xmlhttp.responseText);
			} else {
				// propagate result down the tree
				this.rootResponse = this.parent.rootResponse;
			}
		};

	ClientIterationData.prototype.addExpression=function(expr, canBeInvalid, editable) {
			if (this.rootResponse != null) {
				if (this.getAnalysis().columnIndex[expr] != null)
					return;
				throw new IllegalStateException("query was already analyzed");
			}

			this.queryData.projections.push(expr);
	};
	
	ClientIterationData.prototype.getExpressionValue=function( expr) {
			if (this.currentIndex == -1) {
				// we're not iterating, our value is not correct
				return null;
			}

			var val = this.currentData[expr];

			var type = this.getAnalysis().columnType[this.getAnalysis().columnIndex[expr]];
			if (val == null)
				return null;

			if (type.slice(0,3)=="ptr") {
				var ret=new Object();
				ret.type= type.slice(4);
				ret.value=val;
				ret.toString=function(){
					return this.value;
				};
				return ret;
			}

			if (this.getExpressionType(expr)=="java.util.Date")
				return new Date(val);
			
			if (this.getExpressionType(expr)=="java.lang.Integer")
				return parseInt(val);
			return val;
		};
		
	ClientIterationData.prototype.getExpressionIndex=function( label) {
			return this.getAnalysis().columnIndex[label];
		};

	ClientIterationData.prototype.getExpressionValueInt=function( j) {
			return this.getExpressionValue(this.getAnalysis().columnName[j]);
		};

	ClientIterationData.prototype.getExpressionType=function(expr){
		return this.getAnalysis().columnType[this.getExpressionIndex(expr)];
	};
