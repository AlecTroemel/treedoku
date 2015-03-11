

//**********************        main rendering      ********************************************




//**********************        springy stuff       ***********************************
createGraph();
var nodePositions = new Array(nodeArray.length);
var edgePositions = new Array(edgeArray.length);

var layout = new Springy.Layout.ForceDirected(
    graph,
    400.0, // Spring stiffness
    400.0, // Node repulsion
    0.5 // Damping
);

// calculate bounding box of graph layout.. with ease-in
var currentBB = layout.getBoundingBox();
var targetBB = {bottomleft: new Springy.Vector(-2, -2), topright: new Springy.Vector(2, 2)};

// convert to/from screen coordinates
var toScreen = function(p) {
    
    var size = currentBB.topright.subtract(currentBB.bottomleft);
    var sx = p.subtract(currentBB.bottomleft).divide(size.x).x * 1000;
    var sy = p.subtract(currentBB.bottomleft).divide(size.y).y * 800;
     //console.log(sx + " , " + sy);
    return new Springy.Vector(sx, sy);
   
};

var fromScreen = function(s) {
    var size = currentBB.topright.subtract(currentBB.bottomleft);
    var px = (s.x / canvas.width) * size.x + currentBB.bottomleft.x;
    var py = (s.y / canvas.height) * size.y + currentBB.bottomleft.y;
    return new Springy.Vector(px, py);
};

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

var renderer = new Springy.Renderer(
    layout,
    function clear() {
    
       
        
    },
    function drawEdge(edge, p1, p2) {
        // add edge points to its array
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

        var paddingX = 6;
        var paddingY = 6;

        var s1 = toScreen(p1).add(offset);
        var s2 = toScreen(p2).add(offset);
        // code to clear screen
        var temp = new Array();
        temp.push(new Point(s1.x,s1.y));
        temp.push(new Point(s2.x,s2.y));
        edgePositions[edge.id] = temp;
        //console.log(temp);
    },
    function drawNode(node, p) {
        // add node position to its array
        var s = toScreen(p);
        nodePositions[node.id] = new Point(s.x, s.y);
    }
);
renderer.start();


//**********************        paper.js stuff       ***********************************
var balls = [];
var nodes = [];
var edges = [];

//create edges 
for(i = 0; i < edgePositions.length; i++) {
    var temp = new Path({
        strokeColor: [0.8],
        strokeWidth: 5    
    });
    temp.add(new Point(0,0));
    temp.add(new Point(1,1));
    edges.push(temp);
}

//create nodes
for(i = 0; i < nodePositions.length; i++) {
    //balls.push(new Ball(10 , (view.center - 20 ) + (i*10), new Point(0,0)));
    var temp =  new Path.Circle({
        center: view.center,
        radius: 40,
        fillColor: 'red'
    });
    nodes.push(temp);
}


function onFrame(event) {
    console.log
    
    for(i = 0; i < edgePositions.length; i++) 
    {
        edges[i].segments[0].point = edgePositions[i][0];
        edges[i].segments[1].point = edgePositions[i][1];
    }
    for (j = 0; j < nodes.length; j++)
    {
        nodes[j].position = nodePositions[j];
    }
}


//click and drag
var selected = null;
var nearest = null;
var dragged = null;

function onMouseDown(event) {
    selected = nearest = dragged = layout.nearest(p);
    var p = fromScreen({x: event.point.x, y: event.point.y});
    node[selected.id].fillColor = 'blue';
/*	
    if (selected.node !== null) {
        dragged.point.m = 10.0;

		if (nodeSelected) {
            nodeSelected(selected.node);
        }
    } */
}

function onMouseDrag(event) {
    
}

//**********************        Jelly ball stufff       **********************************
function Ball(r, p, v) {
    console.log("ball is made");
    this.radius = r;
    this.point = p;
    this.vector = v;
    this.maxVec = 15;
    this.numSegment = Math.floor(r / 3 + 2);
    this.boundOffset = [];
    this.boundOffsetBuff = [];
    this.sidePoints = [];
    this.path = new Path({
        fillColor: {
            hue: Math.random() * 360,
            saturation: 1,
            brightness: 1
        },
        blendMode: 'screen'
    });

    for (var i = 0; i < this.numSegment; i ++) {
        this.boundOffset.push(this.radius);
        this.boundOffsetBuff.push(this.radius);
        this.path.add(new Point());
        this.sidePoints.push(new Point({
            angle: 360 / this.numSegment * i,
            length: 1
        }));
    }
}
Ball.prototype = {

    move: function(a) {
        this.point = a;
    },

    iterate: function() {
        this.checkBorders();
        if (this.vector.length > this.maxVec)
            this.vector.length = this.maxVec;
        this.point += this.vector;
        this.updateShape();
    },

    checkBorders: function() {
        var size = view.size;
        if (this.point.x < -this.radius)
            this.point.x = size.width + this.radius;
        if (this.point.x > size.width + this.radius)
            this.point.x = -this.radius;
        if (this.point.y < -this.radius)
            this.point.y = size.height + this.radius;
        if (this.point.y > size.height + this.radius)
            this.point.y = -this.radius;
    },

    updateShape: function() {
        var segments = this.path.segments;
        for (var i = 0; i < this.numSegment; i ++)
            segments[i].point = this.getSidePoint(i);

        this.path.smooth();
        for (var i = 0; i < this.numSegment; i ++) {
            if (this.boundOffset[i] < this.radius / 4)
                this.boundOffset[i] = this.radius / 4;
            var next = (i + 1) % this.numSegment;
            var prev = (i > 0) ? i - 1 : this.numSegment - 1;
            var offset = this.boundOffset[i];
            offset += (this.radius - offset) / 15;
            offset += ((this.boundOffset[next] + this.boundOffset[prev]) / 2 - offset) / 3;
            this.boundOffsetBuff[i] = this.boundOffset[i] = offset;
        }
    },

    react: function(b) {
        var dist = this.point.getDistance(b.point);
        if (dist < this.radius + b.radius && dist != 0) {
            var overlap = this.radius + b.radius - dist;
            var direc = (this.point - b.point).normalize(overlap * 0.015);
            this.vector += direc;
            b.vector -= direc;

            this.calcBounds(b);
            b.calcBounds(this);
            this.updateBounds();
            b.updateBounds();
        }
    },

    getBoundOffset: function(b) {
        var diff = this.point - b;
        var angle = (diff.angle + 180) % 360;
        return this.boundOffset[Math.floor(angle / 360 * this.boundOffset.length)];
    },

    calcBounds: function(b) {
        for (var i = 0; i < this.numSegment; i ++) {
            var tp = this.getSidePoint(i);
            var bLen = b.getBoundOffset(tp);
            var td = tp.getDistance(b.point);
            if (td < bLen) {
                this.boundOffsetBuff[i] -= (bLen  - td) / 2;
            }
        }
    },

    getSidePoint: function(index) {
        return this.point + this.sidePoints[index] * this.boundOffset[index];
    },

    updateBounds: function() {
        for (var i = 0; i < this.numSegment; i ++)
            this.boundOffset[i] = this.boundOffsetBuff[i];
    }
};