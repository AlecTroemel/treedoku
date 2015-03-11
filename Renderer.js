(function() {

jQuery.fn.springy = function(params) {
	var graph = this.graph = params.graph || new Springy.Graph();
	var nodeFont = "24px Verdana, sans-serif";
	var edgeFont = "20px Verdana, sans-serif";
	var stiffness = params.stiffness || 400.0;
	var repulsion = params.repulsion || 400.0;
	var damping = params.damping || 0.5;
	var minEnergyThreshold = params.minEnergyThreshold || 0.00001;
	var nodeSelected = params.nodeSelected || null;
	var nodeImages = {};
	var edgeLabelsUpright = true;

	var canvas = this[0];
	var ctx = canvas.getContext("2d");
    
    ctx.canvas.width  = (window.innerWidth/2) - 60;
    ctx.canvas.height = window.innerHeight / 2 + 70;
    
	var layout = this.layout = new Springy.Layout.ForceDirected(graph, stiffness, repulsion, damping, minEnergyThreshold);

	// calculate bounding box of graph layout.. with ease-in
	var currentBB = layout.getBoundingBox();
	var targetBB = {bottomleft: new Springy.Vector(-2, -2), topright: new Springy.Vector(2, 2)};

	// auto adjusting bounding box
	Springy.requestAnimationFrame(function adjust() {
		targetBB = layout.getBoundingBox();
		// current gets 20% closer to target every iteration
		currentBB = {
			bottomleft: currentBB.bottomleft.add( targetBB.bottomleft.subtract(currentBB.bottomleft)
				.divide(10)),
			topright: currentBB.topright.add( targetBB.topright.subtract(currentBB.topright)
				.divide(10))
		};

		Springy.requestAnimationFrame(adjust);
	});

	// convert to/from screen coordinates
	var toScreen = function(p) {
		var size = currentBB.topright.subtract(currentBB.bottomleft);
		var sx = p.subtract(currentBB.bottomleft).divide(size.x).x * canvas.width;
		var sy = p.subtract(currentBB.bottomleft).divide(size.y).y * canvas.height;
		return new Springy.Vector(sx, sy);
	};

	var fromScreen = function(s) {
		var size = currentBB.topright.subtract(currentBB.bottomleft);
		var px = (s.x / canvas.width) * size.x + currentBB.bottomleft.x;
		var py = (s.y / canvas.height) * size.y + currentBB.bottomleft.y;
		return new Springy.Vector(px, py);
	};

	// half-assed drag and drop
	var selected = null;
	var nearest = null;
	var dragged = null;

	jQuery(canvas).mousedown(function(e) {
		var pos = jQuery(this).offset();
		var p = fromScreen({x: e.pageX - pos.left, y: e.pageY - pos.top});
		selected = nearest = dragged = layout.nearest(p);

		if (selected.node !== null) {
			dragged.point.m = 10000.0;

			if (nodeSelected) {
				nodeSelected(selected.node);
			}
		}
		renderer.start();
	});

	// Basic double click handler
	jQuery(canvas).dblclick(function(e) {
		var pos = jQuery(this).offset();
		var p = fromScreen({x: e.pageX - pos.left, y: e.pageY - pos.top});
		selected = layout.nearest(p);
		node = selected.node;
		if (node && node.data && node.data.ondoubleclick) {
			node.data.ondoubleclick();
		}
	});

	jQuery(canvas).mousemove(function(e) {
      
		var pos = jQuery(this).offset();
		var p = fromScreen({x: e.pageX - pos.left, y: e.pageY - pos.top});
		nearest = layout.nearest(p);

		if (dragged !== null && dragged.node !== null) {
			dragged.point.p.x = p.x;
			dragged.point.p.y = p.y;
		}

		renderer.start();
	});

	jQuery(window).bind('mouseup',function(e) {
		dragged = null;	
        selected = null;
	    nearest = null;

	});

	var getTextWidth = function(node) {
		var text = (node.data.label !== undefined) ? node.data.label : node.id;
		if (node._width && node._width[text])
			return node._width[text];

		ctx.save();
		ctx.font = (node.data.font !== undefined) ? node.data.font : nodeFont;
		var width = ctx.measureText(text).width;
		ctx.restore();

		node._width || (node._width = {});
		node._width[text] = width;

		return width;
	};

	var getTextHeight = function(node) {
		return 16;
		// In a more modular world, this would actually read the font size, but I think leaving it a constant is sufficient for now.
		// If you change the font size, I'd adjust this too.
	};

	var getImageWidth = function(node) {
		var width = (node.data.image.width !== undefined) ? node.data.image.width : nodeImages[node.data.image.src].object.width;
		return width;
	}

	var getImageHeight = function(node) {
		var height = (node.data.image.height !== undefined) ? node.data.image.height : nodeImages[node.data.image.src].object.height;
		return height;
	}

	Springy.Node.prototype.getHeight = function() {
		var height;
		if (this.data.image == undefined) {
			height = getTextHeight(this);
		} else {
			if (this.data.image.src in nodeImages && nodeImages[this.data.image.src].loaded) {
				height = getImageHeight(this);
			} else {height = 10;}
		}
		return height;
	}

	Springy.Node.prototype.getWidth = function() {
		var width;
		if (this.data.image == undefined) {
			width = getTextWidth(this);
		} else {
			if (this.data.image.src in nodeImages && nodeImages[this.data.image.src].loaded) {
				width = getImageWidth(this);
			} else {width = 10;}
		}
		return width;
	}

	var renderer = this.renderer = new Springy.Renderer(layout,
                                                        
        //function to clear canvas                                    
		function clear() {
            ctx.clearRect(0,0,canvas.width,canvas.height);
		},
                   
        //draws the edge lines 
		function drawEdge(edge, p1, p2) {
			var x1 = toScreen(p1).x;
			var y1 = toScreen(p1).y;
			var x2 = toScreen(p2).x;
			var y2 = toScreen(p2).y;

			var direction = new Springy.Vector(x2-x1, y2-y1);
			var normal = direction.normal().normalise();

			var from = graph.getEdges(edge.source, edge.target);
			var to = graph.getEdges(edge.target, edge.source);

			var total = from.length + to.length;

			// Figure out edge's position in relation to other edges between the same nodes
			var n = 0;
			for (var i=0; i<from.length; i++) {
				if (from[i].id === edge.id) {
					n = i;
				}
			}

			//change default to  10.0 to allow text fit between edges
			var spacing = 12.0;

			// Figure out how far off center the line should be drawn
			var offset = normal.multiply(-((total - 1) * spacing)/2.0 + (n * spacing));
			var s1 = toScreen(p1).add(offset);
			var s2 = toScreen(p2).add(offset);

            var stroke = (edge.data.color !== undefined) ? edge.data.color : '#000000';
            var weight = (edge.data.weight !== undefined) ? edge.data.weight : 1.0;
            ctx.lineWidth = Math.max(weight *  2, 0.1);
        
			ctx.strokeStyle = stroke;
			ctx.beginPath();
			ctx.moveTo(s1.x, s1.y);
			ctx.lineTo(s2.x, s2.y);
			ctx.stroke();       
        
        //********************      draws the label of the node, the actual number in our case
        
			// edge label
			if (edge.data.label !== undefined) {
				ctx.fillRect(10,10, 10,10);
                text = edge.data.label
				ctx.save();
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				ctx.font = (edge.data.font !== undefined) ? edge.data.font : edgeFont;
				ctx.fillStyle = stroke;
                
				
				var displacement = -8;	
				var textPos = s1.add(s2).divide(2).add(normal.multiply(displacement));
                
                //we'll need to offset the text off the line here 
				ctx.translate(textPos.x, textPos.y);
                
                ctx.fillStyle = "#2d3539";
				ctx.fillText(text, 0,-2);
				ctx.restore();
			}

		},
                                                        
        //*******************draw node function, draws padding and stuff onto string 
		function drawNode(node, p) {
			var s = toScreen(p);

			ctx.save();

			// Pulled out the padding aspect sso that the size functions could be used in multiple places
			// These should probably be settable by the user (and scoped higher) but this suffices for now
			var paddingX = 40;
			var paddingY = 40;

			var contentWidth = node.getWidth();
			var contentHeight = node.getHeight();
			var boxWidth = contentWidth + paddingX;
			var boxHeight = contentHeight + paddingY;

            //clear circle
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(s.x,s.y  , boxWidth/2, boxHeight/2, Math.PI*2, true); 
            ctx.closePath();
            
            ctx.fill();
        
			// fill background to desired colors 
			if (selected !== null && selected.node !== null && selected.node.id === node.id) {           //selected 
				ctx.fillStyle = "#008282";
			} else if (nearest !== null && nearest.node !== null && nearest.node.id === node.id) {       //highlighted 
				ctx.fillStyle = "#71c4a9";
			} else {                                                                                     //not selected or highlighted 
				ctx.fillStyle = "#9fdabc";
			}
            
            //draw a circle
            ctx.beginPath();
            ctx.arc(s.x,s.y  , boxWidth/2, boxHeight/2, Math.PI*2, true); 
            ctx.closePath();
            ctx.fill();
        
			if (node.data.image == undefined) {
				ctx.textAlign = "left";
				ctx.textBaseline = "top";
				ctx.font = (node.data.font !== undefined) ? node.data.font : nodeFont;
				ctx.fillStyle = (node.data.color !== undefined) ? node.data.color : "#000000";
				var text = (node.data.label !== undefined) ? node.data.label : node.id;
				ctx.fillText(text, s.x - contentWidth/2, s.y - contentHeight/2);
			} else {
				// Currently we just ignore any labels if the image object is set. One might want to extend this logic to allow for both, or other composite nodes.
				var src = node.data.image.src;  // There should probably be a sanity check here too, but un-src-ed images aren't exaclty a disaster.
				if (src in nodeImages) {
					if (nodeImages[src].loaded) {
						// Our image is loaded, so it's safe to draw
						ctx.drawImage(nodeImages[src].object, s.x - contentWidth/2, s.y - contentHeight/2, contentWidth, contentHeight);
					}
				}else{
					// First time seeing an image with this src address, so add it to our set of image objects
					// Note: we index images by their src to avoid making too many duplicates
					nodeImages[src] = {};
					var img = new Image();
					nodeImages[src].object = img;
					img.addEventListener("load", function () {
						// HTMLImageElement objects are very finicky about being used before they are loaded, so we set a flag when it is done
						nodeImages[src].loaded = true;
					});
					img.src = src;
				}
			}
            
			ctx.restore();
		}
	);

	renderer.start();
	return this;
}

})();