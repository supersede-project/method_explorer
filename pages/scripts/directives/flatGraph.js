(function () {
    'use strict';
    function getSelf(d) {
        return d;
    }
    function getId(d) {
        return d.id;
    }
    function getX(d) {
        return d.x;
    }
    function getY(d) {
        return d.y;
    }
    function getHeight(d) {
        return d.height;
    }
    function getWidth(d) {
        return d.width;
    }
    function getText(d) {
        return d.text;
    }
    angular.module('myApp.directives').directive('flatGraph', function ($window) {
        return {
            restrict: 'EA',
            scope: {
                data: "=",
                onClick: "&"
            },
            link: function (scope, iElement, iAttrs) {
                //directed edges don't work in IE
                var internetExplorer = (navigator.appName == 'Microsoft Internet Explorer' || !!(navigator.userAgent.match(/Trident/) || navigator.userAgent.match(/rv:11/)) || (typeof $.browser !== "undefined" && $.browser.msie == 1));
                var preventRender = false;
                var d3 = $window.d3;
                var svg = d3.select(iElement[0])
                        .append("svg")
                        .call(d3.zoom()
                                .scaleExtent([0.1, 7.0])
                                .on("zoom", zoomFunction))
                        .on("dblclick.zoom", null);
                var rootLayer = svg.append("g");
                function preventEvent() {
                    d3.event.stopPropagation();
                }

                var contentLayer = rootLayer.append("g");
                var backLayer = contentLayer.append("g")
                        .attr("id", "back-layer");
                var edgeLayer = contentLayer.append("g")
                        .attr("id", "edge-layer");
                var nodeLayer = contentLayer.append("g")
                        .attr("id", "node-layer");
                var textLayer = contentLayer.append("g")
                        .attr("id", "text-layer");
                var navLayer = rootLayer.append("g");
                navLayer.append("rect") //internet explorer and chrome seem to draw some negative x coordinates if padding is enabled
                        .attr("width", 25)
                        .attr("height", 2000)
                        .attr("x", -25)
                        .attr("y", 0)
                        .attr("fill", "white");
                var leftScroll = navLayer.append("text")
                        .attr("dy", "-0.05em")
                        .style("fill", 'grey')
                        .attr("font-size", 50)
                        .attr("class", "icon navigator")
                        .text("\uf104");
                var rightScroll = navLayer.append("text")
                        .attr("dy", "-0.05em")
                        .style("fill", 'grey')
                        .attr("font-size", 50)
                        .attr("class", "icon navigator")
                        .text("\uf105");
                var updateScroll = function () {};
                var navLabels = navLayer.append("g");
                var dummyLayer = rootLayer.append("g");
                var dummyText = dummyLayer.append("text");
                var dummyRect = dummyLayer.append("rect");
                var defaultHeight = 500;
                var cellPadding = 5; //firefox doesn't support this css property in svg
                var nodePadding = 4; //firefox doesn't support this css property in svg
                var rootXTranslate = 0;
                var rootXTranslateMax = 1000000;
                var rootScale = 1.0;
                var edgeYSpan = 10;
                var edgeXSpan = 5;
                var edgeYPad = 15;
                var iconMap = {
                    'input-artifact': "\uf0c5",
                    'activity': "\uf013",
                    'output-artifact': "\uf0c5",
                    'role': "\uf007",
                    'tool': "\uf0ad"
                };
                function zoomFunction() {
                    var orig = d3.event.transform;
                    //scaling/zooming feels better in a transition, while dragging gets "sticky" in a transition
                    orig.x = Math.max(-rootXTranslateMax * orig.k, Math.min(orig.x, 0));
                    rootXTranslate = orig.x;
                    if (rootScale !== orig.k) {
                        rootScale = orig.k; //firefox text rendering behaves oddly for fractional scaling, so maybe disable zooming in firefox?
                        navLayer.transition().attr("transform", "scale(" + rootScale + ")")
                        contentLayer.transition().attr("transform", "translate(" + rootXTranslate + ",0)scale(" + rootScale + ")");
                        svg.transition().attr("height", defaultHeight * rootScale);
                    } else {
                        contentLayer.attr("transform", "translate(" + rootXTranslate + ",0)scale(" + rootScale + ")");
                    }
                    //this may be a bit problematic, maybe add an an "onLayout" event to be future proof
//                      if (clickEventObject && clickEventObject.update)
//                        notifyClick(clickEventObject.update());
                    //I now just reset the clicked element, zooming was just problematic
                    updateScroll();
                    resetClicked();
                }

                var defs = svg.append("svg:defs");
                defs.append("svg:marker")
                        .attr("id", "arrowInherit")
                        .attr("viewBox", "0 -10 20 20")
                        .attr('refX', 1)
                        .attr("markerWidth", 10)
                        .attr("markerHeight", 10)
                        .attr("fill", 'black')
                        .attr("orient", "auto")
                        .append("svg:path")
                        .attr("d", "M 7,-5L 0,0 L 7,5Z");
                defs.append("svg:marker")
                        .attr("id", "arrowRequire")
                        .attr("class", "my-edge activity")
                        .attr("viewBox", "-10 -10 20 20")
                        .attr('refX', 0)
                        .attr("fill", "none")
                        .attr("markerWidth", 10)
                        .attr("markerHeight", 10)
                        .attr("orient", "auto")
                        .append("svg:path")
                        .attr("d", "M-10,-10L0,0L-10,10");
                defs.append("scg:pattern")
                        .attr("id", "pinstripe")
                        .attr("patterUnits", "userSpaceOnUse")
                        .attr("width", "10")
                        .attr("height", "10")
                        .attr("patternTransform", "rotate(45)")
                        .append("svg:line")
                        .attr("x1", "0")
                        .attr("y1", "0")
                        .attr("x2", "0")
                        .attr("y2", "10")
                        .attr("stroke", "black")
                        .attr("stroke-width", "1");

                function debug(obj) {
                    //print function avoiding endless recursion
                    var seen = [];
                    console.log(JSON.stringify(obj, function (key, val) {
                        if (key === "data" || key === "source" || key === "target")
                            return;
                        if (val != null && typeof val == "object") {
                            if (seen.indexOf(val) >= 0) {
                                return;
                            }
                            seen.push(val);
                        }
                        return val;
                    }));
                }
                function printInsNOuts(nodes, nodeIdx) {
                    //method printing the edge positioning data
                    function repeatChar(count, ch) {
                        var txt = "";
                        for (var i = 0; i < count; i++)
                            txt += ch;
                        return txt;
                    }
                    var lines = [""];
                    for (var i = 0; i < nodes.length; i++) {
                        var node = nodes[i];

                        for (var j = 0; j < node.ins.length; j++)
                            if (node.ins[j]) {
                                if (lines[j + 1])
                                    lines[j + 1] += repeatChar(lines[0].length - lines[j + 1].length, " ");
                                else
                                    lines[j + 1] = repeatChar(lines[0].length, " ");
                                lines[j + 1] += nodeIdx[node.ins[j]] + " ";
                            }
                        lines[0] += nodeIdx[node.id] + " " + ((nodeIdx[node.id] < 10) ? " " : "");

                        for (var j = 0; j < node.outs.length; j++)
                            if (node.outs[j]) {
                                if (lines[j + 1])
                                    lines[j + 1] += repeatChar(lines[0].length - lines[j + 1].length, " ");
                                else
                                    lines[j + 1] = repeatChar(lines[0].length, " ");
                                lines[j + 1] += nodeIdx[node.outs[j]] + " ";
                            }
                        lines[0] += nodeIdx[node.id] + " " + ((nodeIdx[node.id] < 10) ? " " : "");
                    }
                    var str = "";
                    for (var i = 0; i < lines.length; i++)
                        str += lines[i] + "\n";
                    console.log(str);
                }

                window.onresize = function () {
                    return scope.$apply();
                };
                scope.$watch(function () {
                    return angular.element(window)[0].innerWidth;
                }, function () {
                    return scope.render(scope.data, true);
                });

                //now a bunch of methods for caching element base sizes since these ops are pretty expensive
                var textWidthCache = {}
                function getTextWidth(text, clazz) {
                    text = text || "X";
                    clazz = clazz || 'my-node';
                    if (!textWidthCache[clazz] || !textWidthCache[clazz][text])
                        computeDummy(clazz, text);
                    return textWidthCache[clazz][text];
                }
                var textHeightCache = {}
                function getTextHeight(clazz) {
                    clazz = clazz || 'my-node';
                    if (!textHeightCache[clazz])
                        computeDummy(clazz, "Xyzq");
                    return textHeightCache[clazz];
                }
                var styleCache = {};
                function getNodeStyleProperty(property, clazz) {
                    clazz = clazz || 'my-node';
                    if (!styleCache[clazz])
                        styleCache[clazz] = {};
                    if (styleCache[clazz][property] === undefined) {
//                        console.log("recomputing " + property + " " + clazz);
                        dummyRect.attr("class", clazz);
                        styleCache[clazz][property] = getComputedStyleValue(dummyRect, property);
                    }
                    return styleCache[clazz][property];
                }
                function getComputedStyleValue(elem, property) {
                    return  parseFloat($window.getComputedStyle(elem.node()).getPropertyValue(property)) || 0;
                }
                function computeDummy(clazz, text) {
                    dummyLayer.attr('display', null); //in firefox size computation fails for ' none' displayed elements                
                    dummyText.attr("class", clazz)
                            .text(text)
                            .each(function (d, i) {
                                if (!textWidthCache[clazz])
                                    textWidthCache[clazz] = new Object();
                                textWidthCache[clazz][text] = this.getComputedTextLength();
                            });
                    if (!textHeightCache[clazz])
                        textHeightCache[clazz] = getComputedStyleValue(dummyText, 'font-size');
                    dummyLayer.attr('display', 'none');
                }

                scope.$watch('data', function (newVals, oldVals) {
                    return scope.render(newVals);
                }, true);
                var navData = [{id: "input-artifact", text: "Input Artifacts"},
                    {id: "activity", text: "Activities"},
                    {id: "output-artifact", text: "Output Artifacts"},
                    {id: "role", text: "Roles"},
                    {id: "tool", text: "Tools"}];
                scope.render = function (data) {
                    if (preventRender)
                        return;
                    var rect = svg.node().parentNode.getBoundingClientRect();
                    var width = rect.width;
                    rect = svg.node().getBoundingClientRect();
                    svg.attr("width", width);
                    var headerSize = getTextHeight("my-header");
                    var headerBorder = getNodeStyleProperty("stroke-width", "my-header");
                    //set initial row heights
                    var acc = 0;
                    var navElemHeight = 0; // Math.floor((height - 10) / navData.length);
                    for (var i = 0; i < navData.length; i++) {
                        var bor = headerBorder;
                        if (navData[i].collapsed) {
                            navData[i].height = 2 * bor + headerSize + 2 * cellPadding;
                            navData[i].width = 2 * bor + Math.max(navElemHeight, getTextWidth(navData[i].text, "my-header") + 8);
                        } else {
                            navData[i].height = 2 * bor + Math.max(navElemHeight, getTextWidth(navData[i].text, "my-header") + 8);
                            navData[i].width = 2 * bor + headerSize + 2 * cellPadding;
                        }
                        navData[i].x = bor / 2;
                        navData[i].y = acc + bor / 2;
                        acc += navData[i].height + 1 + bor;
                    }

                    var nodes = data.nodes;
                    var nodeIdx = {};
                    console.log(nodes);
                    //compute next edge heights
                    for (var i = 0; i < nodes.length; i++) {
                        nodeIdx[nodes[i].id] = i;
                        nodes[i].ins = [];
                        nodes[i].outs = [];
                        for (var j = 0; j < nodes[i].uiNexts; j++)
                            nodes[i].uiNexts[j].level = 0;
                    }

                    function makeEdges(searchLimit) {
                        for (var i = 0; i < nodes.length; i++) {
                            var startNode = nodes[i];
                            var startId = startNode.id;
                            for (var j = 0; j < startNode.uiNexts.length; j++) {
                                var curEdge = startNode.uiNexts[j];
                                var endId = curEdge.id;
                                var endIdx = nodeIdx[endId];
                                if (endIdx && Math.abs(endIdx - i) < searchLimit) {
                                    var endNode = nodes[endIdx];
                                    var s = Math.min(i, endIdx);
                                    var e = Math.max(i, endIdx);
                                    var ok = false;
                                    var level = -1;
                                    while (!ok) {
                                        level++;
                                        ok = true;
                                        for (var k = s + 1; ok && k < e; k++) {
                                            var ins = nodes[k].ins[level];
                                            var outs = nodes[k].outs[level];
                                            ok = ok && (!ins || ins === endId) && (!outs || outs === endId);
                                        }
                                        var ins = startNode.outs[level];
                                        var outs = endNode.ins[level];
                                        ok = ok && (!ins || ins === endId) && (!outs || outs === endId);

                                    }
                                    for (var k = s + 1; ok && k < e; k++) {
                                        nodes[k].ins[level] = endId;
                                        nodes[k].outs[level] = endId;
                                    }
                                    if (i + 1 === endIdx)
                                        level = 0; //swallow the single step forward eges
                                    else {
                                        startNode.outs[level] = endId;
                                        endNode.ins[level] = endId;
                                    }
                                    curEdge.level = level;
                                    curEdge.dist = endIdx - i;
                                }

                            }
                        }
                    }
                    //I first connect edges of length 2, then 3,  then "randomly",
                    // in order to avoid wierdness of horizontally short edges being "vertically long".
                    makeEdges(2);
//                    makeEdges(3);
                    makeEdges(nodes.length);
                    printInsNOuts(nodes, nodeIdx);
                    //compute minimal cell sizes & set x
                    var acc = headerSize + 2 * cellPadding + 2 * headerBorder;
                    for (var i = 0; i < nodes.length; i++) {
                        nodes[i].width = 0;
                        nodes[i].heights = [];
                        for (var j = 0; j < navData.length; j++)
                            cellSize(j, i);
                        nodes[i].x = acc;
                        acc += Math.max(30, nodes[i].width) + 4;
                    }
                    //arrange cell elements
                    for (var i = 0; i < nodes.length; i++)
                        for (var j = 0; j < navData.length; j++)
                            if (!navData[j].collapsed)
                                cellArrange(j, i);
                    //set final row heights
                    var acc = 0;
                    for (var i = 0; i < navData.length; i++) {
                        navData[i].y = acc;
                        acc += navData[i].height + 4;
                    }
                    //and then the total size of our svg
                    defaultHeight = acc;
                    svg.attr("height", acc * rootScale);
                    rootXTranslateMax = (nodes.length > 0) ? nodes[nodes.length - 1].x : 1000000;

                    updateScroll = function () {
                        leftScroll.attr("x", navData[navData.length - 1].width + 4)
                                .attr("y", defaultHeight)
                                .transition().style('opacity', function () {
                            return (rootXTranslate === 0) ? 0 : 1;
                        });
                        rightScroll.transition().attr("x", navData[navData.length - 1].width + 4 + ((rootXTranslate === 0) ? 0 : 22))
                                .attr("y", defaultHeight)
                                .style('opacity', function () {
                                    return ((rootXTranslateMax - width) * rootScale + rootXTranslate <= 0.001) ? 0 : 1;
                                });
                    };
                    updateScroll();

                    function stackSize(elems, clazz) {
                        var pad = nodePadding;
                        var nclazz = "my-node " + clazz;
                        //to be honest I overestimated the usefulness off css for managing svg properties
                        //since every browser seems to handle the svg css properties differently
                        //it would have been easier to just use globals in this file.. but I realized that when I was done.
                        var maT = getNodeStyleProperty('margin-top', nclazz);
                        var maB = getNodeStyleProperty('margin-bottom', nclazz);
                        var maL = getNodeStyleProperty('margin-left', nclazz);
                        var maR = getNodeStyleProperty('margin-right', nclazz);
                        var bor = getNodeStyleProperty('stroke-width', nclazz);
                        var iw = iconMap[clazz] ? getTextWidth(iconMap[clazz], "icon " + clazz) : 0;
                        var space = 2 * pad + bor;
                        var cellwidth = 0;
                        var cellheight = 0;
                        var elemHeight = getTextHeight(nclazz) + space;
                        for (var i = 0; i < elems.length; i++) {
                            var twidth = getTextWidth(((elems[i].prefix) ? elems[i].prefix : "") + data.labels[elems[i].id], nclazz);
                            var width = Math.ceil(space + iw + twidth + maL + maR);
                            elems[i].width = width;
                            cellwidth = Math.max(cellwidth, width + bor);
                            elems[i].height = elemHeight;
                            cellheight += elemHeight + maT + maB + bor;
                        }
                        return [cellwidth, cellheight];
                    }

                    function stackArrangeY(elems, ystart, clazz) {
                        var maT = getNodeStyleProperty('margin-top', clazz);
                        var maB = getNodeStyleProperty('margin-bottom', clazz);
                        var bor = getNodeStyleProperty('stroke-width', clazz);
                        var cellheight = maT + bor / 2;
                        for (var i = 0; i < elems.length; i++) {
                            elems[i].y = ystart + cellheight;
                            cellheight += elems[i].height + maT + maB + bor;
                        }
                    }
                    function stackArrange(elems, xstart, ystart, clazz) {
                        stackArrangeY(elems, ystart, clazz);
                        var maL = getNodeStyleProperty('margin-left', clazz);
                        var bor = getNodeStyleProperty('stroke-width', clazz);
                        for (var i = 0; i < elems.length; i++)
                            elems[i].x = maL + bor / 2 + xstart;
                    }
                    function stackArrangeCentering(elems, xstart, ystart, cellwidth, clazz) {
                        stackArrangeY(elems, ystart, clazz);
                        var maL = getNodeStyleProperty('margin-left', clazz);
                        var maR = getNodeStyleProperty('margin-right', clazz);
                        var bor = getNodeStyleProperty('stroke-width', clazz);
                        for (var i = 0; i < elems.length; i++)
                            elems[i].x = (cellwidth - elems[i].width - maL - maR) / 2 + xstart;
                    }
                    function stackArrangeRight(elems, xstart, ystart, cellwidth, clazz) {
                        stackArrangeY(elems, ystart, clazz);
                        var maL = getNodeStyleProperty('margin-left', clazz);
                        var maR = getNodeStyleProperty('margin-right', clazz);
                        var bor = getNodeStyleProperty('stroke-width', clazz);
                        for (var i = 0; i < elems.length; i++)
                            elems[i].x = cellwidth - elems[i].width - xstart;
                    }

                    function cellSize(ri, ci) {
                        var row = navData[ri];
                        var column = nodes[ci];
                        var elems = getCellData(row, column);
                        var cellwidth = 0;
                        var cellheight = 0;
                        if (row.id === "activity") {
                            var act = column.activity;
                            var aSize = column.aSize = stackSize([act], "activity");
                            var pSize = column.pSize = stackSize(column.uiParents, "parents");
                            cellwidth = Math.max(aSize[0], pSize[0]);
                            cellheight = aSize[1] + pSize[1] + Math.max(column.ins.length, column.outs.length) * edgeYSpan + edgeYPad;
                        } else {
                            var size = stackSize(elems, row.id);
                            cellwidth = size[0];
                            cellheight = size[1];
                        }
                        column.heights[ri] = cellheight;
                        column.width = Math.max(column.width, cellwidth + 2 * cellPadding);
                        if (!row.collapsed)
                            row.height = Math.max(row.height, cellheight + 2 * cellPadding);
                    }

                    function cellArrange(ri, ci) {
                        var row = navData[ri];
                        var column = nodes[ci];
                        var elems = getCellData(row, column);
                        if (row.id === "activity") {
                            var aSize = column.aSize;
                            var pSize = column.pSize;
                            var xSpan = 10;
                            var actLeft = cellPadding;
                            stackArrangeCentering([column.activity], 0, cellPadding + aSize[1], column.width);
                            stackArrangeCentering(column.uiParents, 0, cellPadding - pSize[1] / 2, column.width);
                        } else
                            stackArrangeCentering(elems, 0, (row.height - column.heights[ri]) / 2, column.width);
                    }

//                    console.log(JSON.stringify(nodes[0]));


                    //HEADERS
                    var g = navLabels.selectAll("g")
                            .data(navData);
                    g.exit().remove();
                    var enter = g.enter()
                            .append("g");
                    enter.append("rect")
                            .attr("class", function (d) {
                                return d.id + " my-header";
                            })
                            .attr("x", getX)
                            .attr("width", headerSize)
                            .on("click", onCollapse);
                    var headers = enter.append("text")
                            .attr("class", function (d) {
                                return d.id + " my-header";
                            })
                            .attr("dy", "0.35em")
                            .text(function (d) {
                                return d.text;
                            })
                            .on("click", onCollapse);
                    function onCollapse(d, i) {
                        d.collapsed = !d.collapsed;
                        scope.render(scope.data);
                    }
                    var merge = g.merge(enter);
                    merge.select("rect")
                            .attr("y", function (d) {
                                return d.y + headerBorder / 2;
                            })
                            .attr("height", function (d) {
                                return d.height - headerBorder;
                            })
                            .attr("width", function (d) {
                                return d.width - headerBorder;
                            });
                    merge.select("text")
                            .attr("x", function (d) {
                                if (d.collapsed)
                                    return d.x + (d.width - headerBorder) / 2;
                                return -d.y - d.height / 2;
                            })
                            .attr("y", function (d) {
                                if (d.collapsed)
                                    return d.y + d.height / 2;
                                return d.x + (d.width - headerBorder) / 2;
                            })
                            .attr("transform", function (d) {
                                if (d.collapsed)
                                    return "";
                                return "rotate(-90,0,0)";
                            });

                    //BACKGROUNDS
                    updateCells(backLayer, function (cell, row, column) {
                        var rects = cell.selectAll("rect").data([0]);
                        var rectsenter = rects.enter()
                                .append("rect")
                                .attr("class", row.id + " my-background")
                                .on("click", resetClicked);
                        rects.merge(rectsenter)
                                .attr("height", row.height)
                                .attr("width", column.width);
                    }, true);
                    //RECTANGLES
                    function createNode(cell, celldata, clazz) {
                        var rects = cell.selectAll("." + clazz).data(celldata);
                        var rectsenter = rects.enter()
                                .append("rect")
                                .attr("rx", 8)
                                .attr("ry", 8)
                                .attr("class", function (d) {
                                    return d.id + " my-node " + clazz;
                                });
//                                .on("click", clicker)
//                                .on("mouseover", onMouseOver)
//                                .on("mouseout", onMouseOut);
                        rects.exit().remove();
                        rects.merge(rectsenter)
                                .attr("x", getX)
                                .attr("y", getY)
                                .attr("height", getHeight)
                                .attr("width", getWidth);
                    }
                    function getCellData(row, column) {
                        var data = [];
                        if (row.id === "input-artifact")
                            data = column.uiInArtifacts;
                        if (row.id === "output-artifact")
                            data = column.uiOutArtifacts;
                        if (row.id === "role" && (!column.removed || !column.manualizable))
                            data = column.uiRoles;
                        if (row.id === "tool" && (!column.removed || !column.manualizable))
                            data = column.uiTools;
                        return data;
                    }
                    updateCells(nodeLayer, function (cell, row, column) {
                        if (row.id === "activity") {
                            createNode(cell, [column.activity], "activity");
                            createNode(cell, column.uiParents, "parent");
                        } else
                            createNode(cell, getCellData(row, column), row.id);
                    });
                    //TEXTS
                    function createText(cell, celldata, clazz, column, row) {
                        var maL = getNodeStyleProperty('margin-left', "my-node " + clazz);
                        var bor = getNodeStyleProperty('stroke-width', "my-node " + clazz);
                        var icon = iconMap[clazz];
                        var iw = icon ? getTextWidth(icon, "icon " + clazz) : 0;
                        var icons = cell.selectAll(".icon." + clazz).data(icon ? celldata : []);
                        var iconsenter = icons.enter()
                                .append("text")
                                .attr("class", "icon " + clazz)
                                .attr("dy", "0.35em")
                                .text(icon);
                        icons.exit().remove();
                        icons.merge(iconsenter)
                                .attr("x", function (d) {
                                    return d.x + maL + bor / 2;
                                })
                                .attr("y", function (d) {
                                    return d.y + (d.height) / 2;
                                });
                        var rects = cell.selectAll(".my-node." + clazz).data(celldata);
                        var addExtraEventData = function (orig) {
                            return function (d, i) {
                                orig(d, i, column, row, clazz);
                            };
                        };
                        var rectsenter = rects.enter()
                                .append("text")
                                .attr("class", function (d) {
                                    return d.id + " my-node " + clazz;
                                })
                                .attr("dy", "0.35em")
                                .on("click", addExtraEventData(onClick))
                                .on("mouseover", addExtraEventData(onMouseOver))
                                .on("mouseout", addExtraEventData(onMouseOut));
                        rects.exit().remove();
                        rects.merge(rectsenter)
                                .attr("x", function (d) {
                                    return d.x + (d.width + iw + maL + bor) / 2;
                                })
                                .attr("y", function (d) {
                                    return d.y + (d.height) / 2;
                                })
                                .text(function (d) {
                                    return ((d.prefix) ? d.prefix : "") + data.labels[d.id];
                                });
                    }
                    updateCells(textLayer, function (cell, row, column) {
                        if (row.id === "activity") {
                            createText(cell, [column.activity], "activity", column, row);
                            createText(cell, column.uiParents, "parents", column, row);
                        } else {
                            createText(cell, getCellData(row, column), row.id, column, row);
                        }
                    });
                    // EDGES
                    updateCells(edgeLayer, function (cell, row, column, rowIdx, colIdx) {
                        if (row.id === "activity") {
                            var border = getNodeStyleProperty('stroke-width');
                            //INHERIT
                            var edges = cell.selectAll(".inherit")
                                    .data(column.uiParents);
                            var edgeenter = edges.enter().append("path")
                                    .attr("class", "my-edge inherit")
                                    .attr('marker-start', "url(#arrowInherit)");
                            edges.merge(edgeenter).attr("d", function (d) {
                                var act = column.activity;
                                var xs = act.x + act.width / 2;
                                var ys = d.y + d.height + border;
                                var ye = act.y - border;
                                return "M" + xs + "," + ys
                                        + "V" + ye;
                            });
                            edges.exit().remove();
                            //REQUIRE
                            edges = cell.selectAll(".my-edge.activity")
                                    .data(column.uiNexts);
                            edgeenter = edges.enter().append("path")
                                    .attr("class", "my-edge activity")
                                    .attr('marker-end', "url(#arrowRequire)");
                            edges.merge(edgeenter).attr("d", function (d) {
                                var act = column.activity;
                                var xs = act.x + act.width;
                                var ys = act.y + act.height / 2;
                                if (colIdx + d.dist >= nodes.length || !nodes[colIdx + d.dist])
                                    return "";
                                var next = nodes[colIdx + d.dist];
                                var xdist = next.x + next.activity.x - column.x - border;
                                if (d.level === 0 && d.dist === 1)
                                    return "M" + xs + "," + ys + "H" + xdist;
                                xs = xs - 10 - d.level * edgeXSpan;
                                ys = act.y + act.height + border;
                                var ydist = d.level * edgeYSpan + edgeYPad;
                                xdist = xdist + 20;
                                return "M" + xs + "," + ys + "v" + ydist + "H" + xdist + "v" + (-ydist);
                            });
                            edges.exit().remove();
                        }
                    });
                    //generic cell selection method
                    function updateCells(layer, cellF, ignoreCollapsed) {
                        var groups = layer
                                .selectAll(function () {
                                    return this.childNodes;
                                })
                                .data(data.nodes, getId);
                        groups.exit().remove();
                        var groupsenter = groups.enter().append("g")
                                .attr("class", getId);
                        groups.merge(groupsenter)
                                .attr("transform", function (d) {
                                    return "translate(" + d.x + ",0)";
                                }).each(function (groupData, colIdx) {
                            var cells = d3.select(this)
                                    .selectAll(function () {
                                        return this.childNodes;
                                    })
                                    .data(navData);
                            var cellsenter = cells.enter().append("g")
                                    .attr("class", getId);
                            cells.merge(cellsenter)
                                    .attr("transform", function (d) {
                                        return "translate(0," + d.y + ")";
                                    })
                                    .attr('display', function (d) {
                                        if (d.collapsed && !ignoreCollapsed)
                                            return 'none';
                                        return null;
                                    })
                                    .each(function (row, rowIdx) {
                                        cellF(d3.select(this), row, groupData, rowIdx, colIdx);
                                    });
                        });
                    }
                }

                var clickEventObject;
//                var hoveredNode;
                function resetClicked() {
                    highlight();
                    clickEventObject = createClickEventObj();
                    notifyClick(clickEventObject);
                }
                function onClick(d, i, col, row, clazz) {
                    highlight(d);
                    clickEventObject = createClickEventObj(d, col, row, clazz);
                    notifyClick(clickEventObject);
                }
                function onMouseOver(d, i, col, row, clazz) {
//                    if (hoveredNode.id !== d.id)
//                        showNodeInfo(d, col, row, clazz);
//                    hoveredNode = d;
                }
                function onMouseOut(d, i, col, row, clazz) {
//                    if (lastClicked.id !== d.id)
//                        showNodeInfo(lastClicked, col, row, clazz);
//                    hoveredNode = null;
                }
                function createClickEventObj(d, col, row, clazz) {
                    if (d)
                        return {
                            id: d.id,
                            style: clazz,
                            update: function () {
                                this.x = (col.x + d.x + rootXTranslate) * rootScale;
                                this.y = (row.y + d.y) * rootScale;
                                return this;
                            }
                        }.update();
                    return {};
                }
                function notifyClick(eventObj) {
                    preventRender = true;
                    scope.$apply(function () {
                        scope.onClick({item: eventObj || {}});
                    });
                    preventRender = false;
                }
                var highlightedNode;
                var highlightedNodes = [];
                function highlight(d) {
                    //this is a bit overly complex due to (old) logic to highlight a nodes child nodes
                    if (highlightedNode === d)
                        return;
                    if (highlightedNode) {
                        var parent = highlightedNode.parent || highlightedNode.id;
                        var parentNode = nodeLayer.selectAll("g." + parent);
                        for (var i = 0; i < highlightedNodes.length; i++) {
                            var highlighted = parentNode.selectAll("rect." + highlightedNodes[i]);
                            highlighted.style("fill", null);
                            highlighted.style("stroke", null);
                        }
                        highlightedNodes = [];
                    }
                    if (d) {
                        var parent = d.parent || d.id;
                        var parentNode = nodeLayer.selectAll("g." + parent);
                        var id = d.id;
                        highlightedNodes.push(id);
                        var highlighted = parentNode.selectAll("rect." + id);
                        highlighted.style("fill", function () {
                            var col = d3.rgb(getComputedStyle(this, null).getPropertyValue("fill"));
                            col.opacity = 0.5;
                            return col;
                        });
                        highlighted.style("stroke", function () {
                            var col = d3.rgb(getComputedStyle(this, null).getPropertyValue("stroke"));
                            col.opacity = 0.1;
                            return col;
                        });
                    }
                    highlightedNode = d;
                }
            }


        }
        ;
    });
}());
