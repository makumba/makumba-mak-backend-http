var rMgr;
var tMgr=new TreeManager();

function makRender(backend, annotateButton, dtonButton, pollButton){
	tMgr.exploreTree(document);
	rMgr= new RenderingManager(tMgr, backend, function(x){console.log(x);});

	dtonButton.addEventListener("change", function(){rMgr.setDataOn(dtonButton.checked, document); if(!dtonButton.checked) pollButton.checked=false;}); 
	pollButton.addEventListener("change", function(){rMgr.setDataOn(dtonButton.checked=true, document);});
	annotateButton.addEventListener("change", function(){rMgr.setAnnotated(annotateButton.checked, document);});
    
    //if(dtonButton.checked)
	rMgr.setAnnotated(annotateButton.checked, document);
    rMgr.setDataOn(dtonButton.checked, document);
	setInterval(function(){
		if(pollButton.checked)
			rMgr.updateScene(document);
	}, 1000);
}

function synch(){
	
	// if event.target is <INPUT>
	var expr=event.target.getAttribute("data-value");
	var label= expr.match("[a-z]+");
	var path=expr.substring(label.length+1);
	var ptr= tMgr.getNodeProperties(event.target).objects[label];
   	rMgr.update(ptr.toString(), ptr.type, path, event.target.value,  tMgr.getNodeProperties(event.target).examples[expr+"_type"]);
   	rMgr.updateScene(document);
}

function makdrag(event){
	event.dataTransfer.setData("makDnD", JSON.stringify({dx:event.offsetX, dy:event.offsetY, objects: tMgr.getNodeProperties(event.target).objects}));
	event.dataTransfer.effectAllowed = 'move';
}

function makdrop(event){
	 event.preventDefault();
	 var data=JSON.parse(event.dataTransfer.getData("makDnD"));
	 
	 var dest=tMgr.getNodeProperties(this);
	 if(dest.objects['line']!=null){
	 	rMgr.updateWhere(
			 data.objects['t'].type+" t, "+dest.objects['line'].type+" line",
			 "t.line=line, t.startDate=dateAdd('2011-01-01', :x, 'day')",
			 "t=:t AND line=:line",
			 {t:data.objects['t'].value, line:dest.objects['line'].value, x: event.pageX-this.offsetLeft-data.dx}
	 		);
	}else
		{
	 	rMgr.updateWhere(
				 data.objects['t'].type+" t",
				 "t.line=nil, t.startDate=nil", 
				 "t=:t",
				 {t:data.objects['t'].value}
		 		);
		}
	rMgr.updateScene(document);
}

function makdragover(event){
	 event.preventDefault();
}


function addMakListeners(node){
	if(!node.attributes)
		return;
	if(node.attributes['data-drag']!=null){
		node.addEventListener("dragstart", makdrag, false);
		node.draggable=true;
	}
	if(node.attributes['data-dropOn']!=null){
		node.addEventListener("drop", makdrop, false);
		node.addEventListener("dragover", makdragover, false);
	}
}

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

	RenderingManager.prototype.updateScene=function(root) {
		this.event = "dataOn";
		this.render(root);
		this.event = null;
	};

	RenderingManager.prototype.updateWhere=function(from, set, where, params){
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open("POST", this.ajaxRoot, false);
		xmlhttp.send("updateFrom="+encodeURIComponent(from)+
				"&updateSet="+encodeURIComponent(set)+
				"&updateWhere="+encodeURIComponent(where)+
				"&param="+encodeURIComponent(JSON.stringify(params)));
		console.log(xmlhttp.responseText); 
	};
	
	RenderingManager.prototype.update=function(object, type, path, value, exprType) {		
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open("POST", this.ajaxRoot, false);
		xmlhttp.send("object="+encodeURIComponent(object)+
				"&type="+encodeURIComponent(type)+
				"&path="+encodeURIComponent(path)+
				"&value="+encodeURIComponent(value)+
				"&exprType="+encodeURIComponent(exprType));				
		console.log(xmlhttp.responseText); 
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
			
			if(this.annotated && !this.dataOn && (prop=="text" || prop=="value"))
				param=expr;

			
			// TODO: the type doesn't matter for javascript
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
		if (!("dataOn"==this.event))
			this.renderChildren(node);

		this.renderAnnotations(node);
	};
	
	RenderingManager.prototype.renderAnnotations=function(node){
		if(this.annotated && node.annotation || !this.annotated && !node.annotation)
			return;
		
		if(this.annotated && !node.annotation){
			var fieldset=document.createElement("fieldset");
			fieldset.style.border='1px solid';
			var legend= document.createElement("legend");
			legend.style['font-size']="1em";
			legend.style.color="blue";
			legend.style.width=legend.style.margin=legend.style.padding="inherit";

			var anno= "   FROM "+node.attributes['data-from'].value;
			if(node.attributes['data-where'])
				anno+=" WHERE "+node.attributes['data-where'].value;
			if(node.attributes['data-orderBy'])
				anno+=" ORDER BY "+node.attributes['data-orderBy'].value;
			if(node.attributes['data-groupBy'])
				anno+=" GROUP BY "+node.attributes['data-groupBy'].value;
			if(node.attributes['data-dropOn'])
				anno+=" ;  dropOn "+node.attributes['data-dropOn'].value;
			
			anno+="   ";
			legend.appendChild(document.createTextNode(anno));
			fieldset.appendChild(legend);
			node.parentNode.replaceChild(fieldset, node);
			node.annotation=fieldset;
			fieldset.appendChild(node);
		}
		if(!this.annotated && node.annotation){
			node.annotation.parentNode.replaceChild(node, node.annotation);
			node.annotation=null;
		}
	};

	RenderingManager.prototype.renderBorder=function(node){};

	RenderingManager.prototype.iterateComponents=function(container) {
		
		// this will not do much since iteration nodes don't currently have node
		// properties
		this.setProperties(container);

		var l = Date.now();
		var iterationData = this.tMgr.getIterationData(container);

		// the usual iterationData loop
		if (iterationData.startIteration()) {
	           if (this.tMgr.getChildrenCount(container) == iterationData.iterationSize()
	                    * this.tMgr.getSavedChildren(container).length) {
	                var jk = 0;
	                
	                for (var i = 0; i < iterationData.iterationSize(); i++) {
	                    iterationData.setRowIndex(i);
	                    var len=this.tMgr.getSavedChildren(container).length;
	    				for (var j=0;j<len;j++) {
	    					var c= this.tMgr.getSavedChildren(container)[j];
	                        var comp = this.tMgr.getChildAt(container, jk++);
	                        this.duplicateData(comp, c, iterationData);
	                        this.render(comp);
	                    }
	                }
	            } else {
	            	this.tMgr.removeAllChildren(container);
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
	            }
			var end = Date.now();

			this.log("rendering: "+ (end - l)+ " "+ this.tMgr.getNodeProperties(container).getQueryData());
	           
			// end of iteration
			iterationData.closeIteration();
		}else{
			// remove all children since we may have 0 iterations
			this.tMgr.removeAllChildren(container);
		}
	};

	/* analysis, execution */
	
	RenderingManager.prototype.visitNodeForExpressions = function(node, np){
		for (var s in np.props) {
			this.tMgr.getIterationData(node).addExpression(np.props[s],
					np.canBeInvalidF(np.props[s]), np.isEditable(np.props[s]));
			if(np.props[s].match("[a-z]+[.a-z]+")==np.props[s]){
				var label=np.props[s].match("[a-z]+")[0];
				this.tMgr.getIterationData(node).addExpression(label, false, false);
				np.objects[label]={};
			}
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

	/* data duplication */
	RenderingManager.prototype.duplicateData=function(ret, template, iterationData) {
	 if (this.tMgr.isIterationNode(template)) {
         this.tMgr.setNodeProperties(ret, this.tMgr.getNodeProperties(template).duplicateOn(iterationData));
         this.tMgr.setIterationData(ret, this.tMgr.getIterationData(template));

         // we don't propagate duplication further, the iteration node will
         // duplicate its children when it renders
         return;
     }

     if (this.tMgr.isQueryAnnotatedWidget(template)) {
         this.tMgr.setNodeProperties(ret, this.tMgr.getNodeProperties(template).duplicateOn(iterationData));
     }

     for (var i = 0; i < this.tMgr.getChildrenCount(template); i++)
         this.duplicateData(this.tMgr.getChildAt(ret, i), this.tMgr.getChildAt(template, i), iterationData);
	};
	
	/* duplication */
	RenderingManager.prototype.duplicateTree=function( template, iterationData) {
		var ret = this.tMgr.duplicateNode(template);
		
		addMakListeners(ret);
		ret.annotation= template.annotation;
		
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
				 if( param==null)
					param="";			

			if (this.tMgr.getChildrenCount(node) > 0
					&& (this.tMgr.getChildAt(node, 0).nodeType==3)) {
				node.childNodes.item(0).nodeValue="" + param;
//				$(node).text(""+param);
			}
		} else if("value"==prop){	
				// if we are in focus, we don't change the user-entered value
				if(document.activeElement!=node)
				// setting property rather than attribute
					node.value=param;
        }
        else if("x"==prop){		
            node.style.left=param;
        }
        else if("width"==prop){		
            node.style.width=param;
        }
        else
            node.setAttribute(prop, param);
        	//$(node).attr(prop, param);

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
		//$(container).empty();
		var childNodes = container.childNodes;
		var length = childNodes.length;
		for (var i = 0; i < length; i++) {
			container.removeChild(childNodes.item(0));
		}
	};

	TreeManager.prototype.add=function( container,  comp){
		//$(container).append(comp);
		container.appendChild(comp);		
	};

	TreeManager.prototype.duplicateNode=function(from) {
		return from.cloneNode(false);
		//return $(from).clone().empty()[0];
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

			if(node.tagName=="MAK:VALUE"){
				if(getAttribute(attributes, 'expr')!=null)
					node.setAttribute('data-text', getAttribute(attributes, 'expr'));
				node.appendChild(document.createTextNode(""));				
			}
			if(node.tagName=="MAK:LIST"){
				if(getAttribute(attributes, 'from')!=null)
					node.setAttribute('data-from', getAttribute(attributes, 'from'));
				if(getAttribute(attributes, 'where')!=null)
					node.setAttribute('data-where', getAttribute(attributes, 'where'));
				if(getAttribute(attributes, 'groupBy')!=null)
					node.setAttribute('data-groupBy',getAttribute(attributes, 'groupBy'));
				if(getAttribute(attributes, 'orderBy')!=null)
					node.setAttribute('data-orderBy', getAttribute(attributes, 'orderBy'));
			}
			if (getAttribute(attributes, "data-from") != null) {
				np.setQueryData([getAttribute(attributes, "data-from"), getAttribute(attributes, "data-where"), getAttribute(attributes, "data-groupBy"), getAttribute(attributes, "data-orderBy"), null, null]);
				hasContent = true;				
			} 
			for (var i = 0; i < attributes.length; i++) {
				var n = attributes.item(i);

				
				// everything that starts with data is considerd a mak
				// expression
				if (n.nodeName.substring(0, 5)!="data-")
					continue;

				var name = n.nodeName.substring(5);
				if(name=="from" || name=="where" || name=="groupBy" || name=="orderBy")
					continue;
				hasContent = true;

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
		
			addMakListeners(node);

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
		this.objects={};
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

		ret.examples = {};
		ret.objects= {};

		// if label.prop.prop
		for (var prop in this.props) {
			var expr = this.props[prop];
			ret.examples[expr]= iterationData.getExpressionValue(expr);
			ret.examples[expr+"_type"]=iterationData.getExpressionType(expr);
		}
		for(var obj in this.objects){
			ret.objects[obj]= iterationData.getExpressionValue(obj);
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
				try{
				xmlhttp.send("request="+encodeURIComponent(JSON.stringify(this.rootRequest))+"&analyzeOnly="+analyzeOnly);
				this.rootResponse = JSON.parse(xmlhttp.responseText);
				}catch(exception){
					console.log(exception);
				}
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

			if (this.getExpressionType(expr)=="java.util.Date"){
				var ret= new Date(val);
				ret.toString=function(){
					return this.toDateString();
				};
				return ret;
			}
				
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
