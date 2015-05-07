
$.domReady(function() {

	var w = $(window).width(),
		h = $(window).height(),
		useCachedJson=true,
		scale=1,
		firstRun=true,
		center,
		curNodes = [],
		foci = { center: [.5,.70], owner: [.5,.74], shares: [.5,.2] },
		endpoint = 'http://0.0.0.0:8080',
		nodeSize = function(d) {
			d = nodeDict[d.id];
			if (d.type == "root") return 12*scale;
			//if (d.owner) return Math.max(3.5, Math.sqrt(1) * 10)*scale;
			return Math.max(3.5, Math.sqrt(1) * 7)*scale;
			//return 6;
		},
		linkWidth = function(d) { 
			if (d.type == 'posts') return 1;
			//return (d.share > .9 ? 3.5 : d.share > .75 ? 1.6 : d.share > .5 ? 1 : .7)*Math.pow(scale,0.5)*(d.type == 'root' ? 1.6 :1); 
			return d.type == 'root' ? 1.6 :1;
		},
		fill = function(d) { 
			if (d.type == "projects") return "#e64";
			if (d.type == "posts") return "#4be";
			if (d.type == "something") return "#8db";
			if (d.type == "something_else") return "#eb4";
			if (d.type == "root") return '#222';
			if (d.root) return 'hsl(35,30%,'+(50-50*d.share)+'%)';
			return "hsl(35,40%,70%)";
		},
		strokeWidth = function(d) {
			if (d.id == center.id) return 2.5;
			return 1.2;
		},
		id,parts,vis,nodeDict = {},
		nodeG, linkG,
		hashurl,updateHash,updateGraph,
		maxDepth,
		lastNodes = [], resetLayout = true,
		searchTimer,doSearch;
	
//	if (useCachedJson) $('#search').hide();
	
	vis = d3.select("#gfx").append("svg:svg")
		.attr("width", w)
		.attr("height", h);
		
	linkG = vis.append("svg:g");
	nodeG = vis.append("svg:g");
	
	updateHash = function(hash) {
		parts = hash;
		
		if (useCachedJson) {
			id = "#" + parts;
			$.ajax({ 
				url: 'data.json', 
				type: 'json', 
				success: updateGraph
			});
		} else {
			if (parts[1] == "company") {
				id = parts[2];
				
				$.ajax({ 
					url: endpoint+'/companygraph?id='+id, 
					type: 'jsonp', 
					success: updateGraph
				});
			} else if (parts[1] == "media") {
				id = parts[2];
				
				$.ajax({ 
					url: endpoint+'/mediagraph?id='+id, 
					type: 'jsonp', 
					success: updateGraph
				});
			}
		}
	};

	getAdjNodes = function(graph, node, type) {
		var nodeIndex,i,res=[];
		for (i=0; i<graph.nodes.length; i++) {
			if (graph.nodes[i].id == node.id) {
				nodeIndex = i;
				break;
			}
		}
		for (i=0; i<graph.links.length; i++) {
			if (type == "projects" && graph.links[i].source == nodeIndex && graph.links[i].type == type) {
				res.push(graph.nodes[graph.links[i].target]);
			} else if (type == "root" && graph.links[i].target == nodeIndex && graph.links[i].type == type) {
				res.push(graph.nodes[graph.links[i].target]);
			} else if (type == "posts" && graph.links[i].target == nodeIndex && graph.links[i].type == type) {
				res.push(graph.nodes[graph.links[i].target]);
			}
		}
		return res;
	};
	
	maxDepth = function(graph, node, up) {
		if (node.type != null) {
			node = getAdjNodes(graph, node, 'projects')[0];
		}	
		var maxD=0,d, adjNodes,i;
		adjNodes = getAdjNodes(graph, node, up ? 'projects' : 'root');	
		for (i=0;i<adjNodes.length;i++) {
			d = 1+maxDepth(graph, adjNodes[i], up);
			if (d > maxD) maxD = d;
		}
		return maxD;
	};
	
	updateGraph = function(json) {
		
		resetLayout = true;
		
		json.nodes.forEach(function(o, i) {
			if (lastNodes.indexOf(o.id) >= 0) {
				resetLayout = false;
				return false;
			}
		});
		
		lastNodes = [];
		
		json.nodes.forEach(function(o, i) {
			
			lastNodes.push(o.id);
			
			if (nodeDict.hasOwnProperty(o.id) && !resetLayout) {
				var old = nodeDict[o.id];
				if (!isNaN(old.x)) {
					o.x = old.x;
					o.y = old.y;
				}
			} else {
				o.x = w*(.4 + Math.random()*.2);
				o.y = h*(.6 + Math.random()*.2);
			}
			nodeDict[o.id] = o;
			if (o.type == "root") center = o;
		});
	
		var force,link,node,linkColor,
			shareDepth=maxDepth(json,center,true)+1,
			ownerDepth=maxDepth(json,center,false);
		
		scale = Math.pow(200/json.nodes.length,.22)*.4 + 0.6* 10/(shareDepth + ownerDepth);
		scale *= 0.9;
		
		foci.center[1] = (shareDepth/(shareDepth+ownerDepth)) * .7 + .35;
		foci.shares[1] = foci.center[1] * .3;
		foci.owner[1] = 1-(1-foci.center[1])*0.6;
		
		if (center.type != null) {
			foci.center[1] = .1;
			foci.owner[1] = .8;
			scale = Math.pow(200/json.nodes.length,.22)*.8;
		}
		
		scale *= h/800;
		
		linkColor = function(d) {
			if (d.type == 'posts') {
				if (json.nodes.length > d.target) {
					return d3.interpolateHsl(fill(json.nodes[d.target]), '#000')(0.4);
				}
				return '#ccc';
			}
			if (d.type == 'root') return '#000';
			if (d.type == 'projects') return 'hsl(35,30%,25%)';
		},
		
		force = d3.layout.force()
		  .charge(function(d) { return nodeSize(d)*-20 })
		  .linkDistance(15*Math.pow(scale, 2.5))
		  .nodes(json.nodes)
		  .links(json.links)
		  .size([w, h]);
		
		link = linkG.selectAll("line.link")
		  .data(json.links, function(d) { return d.source.id+'-'+d.target.id } );
		
		link.enter().append("svg:line")
		  .attr("class", "link")
		  .style("stroke-width", linkWidth)
		  .style('stroke', linkColor)
		  .style("stroke-dasharray", function(d) { return d.share < .5 ? '3,3' :  'none' })		
		  .attr("x1", function(d) { return d.source.x; })
		  .attr("y1", function(d) { return d.source.y; })
		  .attr("x2", function(d) { return d.target.x; })
		  .attr("y2", function(d) { return d.target.y; });
		
		link.transition()
		  .style("stroke-width", linkWidth)
		  .style("stroke-dasharray", function(d) { return d.share < .5 ? '3,3' :  'none' })	
		
		link.exit().remove();
		
		node = nodeG.selectAll("circle.node")
		  .data(json.nodes, function(d) { return d.id; });

		node.enter().append("svg:circle")
		  .attr("class", "node")
		  .attr("stroke-width", strokeWidth)
		  .attr("cx", function(d) { return d.x; })
		  .attr("cy", function(d) { return d.y; })
		  .attr("r", nodeSize)
		  .attr("title", function(d) { return d.name })
		  .style("fill", fill)
		  .call(force.drag);
				
		node.on("click", function(n) {
			if (n.id[0] == "#") {
				hashurl.setHash(n.id.substr(1));
			} else {
				hashurl.setHash(n.id);
				center = n;
			}
		});
		
		node.transition()
		  .attr("cx", function(d) { return d.x; })
		  .attr("cy", function(d) { return d.y; })
		  .attr("r", nodeSize)
		  .attr("stroke-width", strokeWidth)
		  .style("fill", fill);

		node.exit().transition()
		  .duration(300)
		  .attr("r", 0)
		  .remove();
		
		force.on("tick", function(e) {
		  // Push nodes toward their designated focus.
		  var k = .1 * e.alpha;
		  
		  json.nodes.forEach(function(o, i) {
		    var fx,fy,k0=1;
		  	if (o.id == center.id) {
		  		fx = w * foci.center[0];
		  		fy = h * foci.center[1];
		  		k0 = 5;
		  	} else if (o.type == "root") {
		  		fx = w * foci.owner[0];
		  		fy = h * foci.owner[1];
		  	} else {
		  		fx = w * foci.shares[0];
		  		fy = h * foci.shares[1];
		  		k0 = 1.42;
		  	}
			o.y += (fy - o.y) * k * k0;
			o.x += (fx - o.x) * k * k0;
		  });
		  
		  node.attr("cx", function(d) { var r=nodeSize(d)*3; return d.x = Math.max(r, Math.min(w - r, d.x)); })
        .attr("cy", function(d) { var r=nodeSize(d)*5; return d.y = Math.max(r, Math.min(h - r - 80, d.y)); });

		
		  vis.selectAll("circle.node")
			  .attr("cx", function(d) { return d.x; })
			  .attr("cy", function(d) { return d.y; });
				
			link.attr("x1", function(d) { return d.source.x; })
				.attr("y1", function(d) { return d.source.y; })
				.attr("x2", function(d) { return d.target.x; })
				.attr("y2", function(d) { return d.target.y; });
			
			node.attr("cx", function(d) { return d.x; })
				.attr("cy", function(d) { return d.y; });
		});
		
		json.nodes.forEach(function(o, i) {
			if (o.id == id) { 
				center = o; 
				document.getElementById("title").innerHTML = o.name;
			} 
		});
		
		$('svg circle').tipsy({
			gravity: 'w'
		});
		
		if (firstRun) {
			firstRun = false;
			force.start();
		} else {
			force.start();
		}
	};
		
	doSearch = function() {
		var q = $('#search').val();
		if (q.trim() == "") {
			$('#links ul li.res').remove();
			$('#links ul li').show();
			return;
		}
		$.ajax({
			url: endpoint+'/search?q='+q,
			type: 'jsonp',
			success: function(json) {
				$('#links ul li.res').remove();
				$('#links ul li').hide();
				var _ul = $('#links ul');
				for (var i=0;i<Math.min(json.length,10);i++) {
					_ul.append('<li class="res"><a href="#/company/'+json[i].id+'">'+json[i].name+'</a></li>');
				}
			}
		});
	};
	
	hashurl = new HashUrls(updateHash);

	$('#search').on('keyup', function() {
		if (searchTimer != null) {
			clearTimeout(searchTimer);
		}
		searchTimer = setTimeout(doSearch, 300);
	});

});
