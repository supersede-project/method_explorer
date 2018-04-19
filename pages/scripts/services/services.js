(function () {
    'use strict';
    angular.module('myApp.services')
            .factory('myutils', [function () {
                    return {
                        interlinkMapper: function (str, mapper) {
                            //detects <asdf<ACT-01-01>> link regions 
                            // and provides them to the mapper function
                            var arr = str.match(/<[^>]*>>|[^<]*/g);
                            for (var i = 0; i < arr.length; i++)
                                if (arr[i].length > 0)
                                    if (arr[i][0] === '<') {
                                        var tmp = arr[i].slice(1, arr[i].length - 2);
                                        tmp = tmp.split("<");
                                        if (tmp.length === 2 && tmp[0] && tmp[1])
                                            mapper(tmp[0] || "", tmp[1] || "");
                                    } else
                                        mapper(arr[i]);
                        },
                        linkMapper: function (str, mapper) {
                            //detects http:// and https:// and then matches until a whitespace occurs
                            var split = str.split(/(?=https?:\/\/\S*)/g);
                            for (var i = 0; i < split.length; i++) {
                                var lnk = split[i].match(/https?:\/\/\S*/g);
                                if (lnk && lnk.length > 0) {
                                    mapper(lnk[0], lnk[0]);
                                    if (lnk[0].length < split[i].length)
                                        mapper(split[i].substring(lnk[0].length));
                                } else
                                    mapper(split[i]);
                            }
                        },
                        parseCSV: function (csv, seperator) {
                            //ok excel fuckin exports csvs with supershitty locale dependant seperators
                            //..so I look for the first ID ID: or "ID:" element and take the char after that.
                            //I know that d3 has a parse CSV method but it can't deal with csvs with 
                            // a variable number of columns, which happens when just copying sheets together
                            //additionally newlines inside cells are not escaped! again bad!
                            //I hope you are ready for some regex magic. I used regex101.com
                            if (!seperator) {
                                seperator = csv.match(/^\"?ID\"?:?(.)/m);
                                seperator = (seperator) ? seperator[1] : ",";
                                console.log("Detecting seperator, seperating csv file with \"" + seperator + "\"")
                            }
                            var regex = new RegExp("\"([^\"]|\"\")*\"|[^" + seperator + "]+|(?=,,)", "g");
                            var lines = csv.match(/([^"\r\n]*("[^"]*")*)+/g); //to eat unescaped newlines
                            return lines.map(function (line) {
                                return (line.match(regex) || []).map(function (str) {
                                    str = str.replace(/\"\"/g, "\"");//" is escaped via ""
                                    if (str[0] === "\"")
                                        return str.slice(1, str.length - 1);
                                    return str;
                                });
                            });
                        }
                    };
                }]);

    angular.module('myApp.services')
            .factory('withGraph', ['myutils', function (myutils) {

                    var data = {
                        nodes: [],
                        edges: [], //{source: nodeObj, target:nodeObj, type:String}
                        labels: {}, // for quickly looking up texts of ids
                        details: {}, //the whole data stuff
                        htmlDetails: {}, // the data stuff but as  html
                        criteria: {}, //the metainformation of possible constraints
                        constraints: {}
                    };

                    data.findById = function (id) {
                        var nodes = data.nodes;
                        for (var i = 0; i < nodes.length; i++) {
                            if (nodes[i].id === id)
                                return nodes[i];
                        }
                        console.warn("Could not find node with id: " + id);
                        return null;
                    }
                    data.addEdge = function (from, to, type) {
                        var from = data.findById(from);
                        var to = data.findById(to);
                        if (from && to) {
                            var edge = {source: from, target: to, type: {}};
                            edge.type[type] = true;
                            data.edges.push(edge);
                        }
                    }

                    data.getOutNodes = function (source, edgeType) {
                        return data.edges.filter(function (e) {
                            return e.source === source && e.type[edgeType];
                        }).map(function (e) {
                            return e.target;
                        });
                    }

                    data.getInNodes = function (target, edgeType) {
                        return data.edges.filter(function (e) {
                            return e.target === target && e.type[edgeType];
                        }).map(function (e) {
                            return e.source;
                        });
                    }
                    function htmlConverter(str) {
                        // <asdf<ACT-01-01>> detector and converter
                        var res = "";
                        myutils.interlinkMapper(str, function (text, link) {
                            if (link) {
                                if (link.indexOf("TOO") === 0)
                                    link = "#!/tools#" + link;
                                else if (link.indexOf("ACT") === 0)
                                    link = "#!/activities#" + link;
                                else if (link.indexOf("ART") === 0)
                                    link = "#!/artifacts#" + link;
                                else if (link.indexOf("ROL") === 0)
                                    link = "#!/roles#" + link;
                                res += '<a href="' + link + '">' + text + '</a>';
                            } else
                                res += text;
                        });
                        //http:// detector and converter
                        var res2 = "";
                        myutils.linkMapper(res, function (text, link) {
                            if (link)
                                res2 += '<a href="' + link + '">' + text + '</a>'
                            else
                                res2 += text;
                        });
                        //newline conversion
                        res2 = res2.replace(/\r\n|\n\r|\n/g, "<br>");
                        if (res2.indexOf("<br>") !== -1)
                            res2 = "<br>" + res2;
                        return res2;
                    }
                    function detailsHtmlConverter(id, data) {
                        var res = {id: id, title: "", phase: "", content: []};
                        var hidden = ["ID:", "Name:", "Responsible:", "MAPE phase:"];
                        for (var i = 0; i < data.length; i++) {
                            var line = data[i];
                            if (line.length < 2 || !line[0] || !line[0].length || !line[1] || !line[1].length)
                                continue;
                            var key = line[0];
                            var value = line[1];
                            if (key.indexOf("MAPE phase") === 0) {
                                res.phase = "monitor";
                                if (value.indexOf("Monitor") === 0)
                                    res.phase = "monitor";
                                else if (value.indexOf("Analyse") === 0)
                                    res.phase = "analyse";
                                else if (value.indexOf("Plan") === 0)
                                    res.phase = "plan";
                                else if (value.indexOf("Enact") === 0)
                                    res.phase = "enact";
                                else
                                    console.warn(id + ' has an unknown MAPE Phase: "' + value + '" adding as if Monitor Phase');
                            }
                            if (key.indexOf("Name") === 0)
                                res.title = value;
                            if (hidden.indexOf(key) === -1)
                                res.content.push({key: key, value: htmlConverter(value)});
                        }
                        return res;
                    }

                    function addNode(_id, _text, _data, type) {
                        var node = {id: _id};
                        if (type === "activity")
                            node.isActivity = true;
                        if (type === "artifact")
                            node.isArtifact = true;
                        if (type === "role")
                            node.isRole = true;
                        if (type === "tool")
                            node.isTool = true;
                        data.nodes.push(node);
                        data.details[_id] = _data;
                        data.labels[_id] = _text;
                        data.htmlDetails[_id] = detailsHtmlConverter(_id, _data);
                    }

                    function addNodes(json, type) {
                        for (var i = 0; i < json.data.length; i++) {
                            var arr = json.data[i];
                            addNode(arr[0][1], arr[1][1], arr, type);
                        }
                    }

                    function addNodesCSV(csv, type) {
                        var lines = myutils.parseCSV(csv);
                        var item = null;
                        //var ignoredColumns = ["MAPE phase:", "Responsible:"];
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i];
                            if (line && line.length > 1 && line[0].length > 0) {
                                if (line[0].match(/^\"?ID\"?:?/)) {
                                    if (item)
                                        addNode(item[0][1], item[1][1], item, type);
                                    item = [];
                                }
                                if (item) //&& ignoredColumns.indexOf(line[0]) === -1)
                                    item.push(line);
                            }
                        }
                        if (item)
                            addNode(item[0][1], item[1][1], item, type);
                    }

                    function parseCriteriaCSV(csv) {
                        var res = {};
                        var lines = myutils.parseCSV(csv, ",");
                        if (!lines || lines.length === 0)
                            return res;
                        var cols = {};
                        for (var i = 0; i < lines[0].length; i++)
                            cols[lines[0][i]] = i;

                        for (var i = 1; i < lines.length; i++)
                            if (lines[i] && lines[i].length > 0) {
                                var line = lines[i];
                                var groupName = line[cols["Criteria Group"]];
                                if (!res[groupName])
                                    res[groupName] = {
                                        title: groupName,
                                        constraints: []};
                                var group = res[groupName];
                                var criteria = {
                                    title: line[cols["Criteria"]],
                                    values: parseConstraintValues(line[cols["Values"]]),
                                    description: line[cols["Explanation"]]
                                };
                                if (line[cols["Multi-select"]])//note the case
                                    criteria["isMulti"] = true;
                                group.constraints.push(criteria);
                            }
                        return res;
                    }
                    function parseConstraintValues(vals) {
                        vals = vals.split(",");
                        for (var i = 0; i < vals.length; i++)
                            vals[i] = $.trim(vals[i]);
                        return vals;
                    }

                    var edgeCSV = "", constraintCSV = "", criteriaGroupsCSV = "";
                    var allDone = $.when($.get("pages/data/activities.csv", function (csv) {
                        console.log("loaded activities.csv");
                        addNodesCSV(csv, "activity");
                    }), $.get("pages/data/artifacts.csv", function (csv) {
                        console.log("loaded artifacts.csv");
                        addNodesCSV(csv, "artifact");
                    }), $.get("pages/data/roles.csv", function (csv) {
                        console.log("loaded roles.csv");
                        addNodesCSV(csv, "role");
                    }), $.get("pages/data/tools.csv", function (csv) {
                        console.log("loaded tools.csv");
                        addNodesCSV(csv, "tool");
                    }), $.get("pages/data/criteria.csv", function (csv) {
                        console.log("loaded criteria.csv");
                        data.criteria = parseCriteriaCSV(csv);
                    }), $.get("pages/data/criteriaGroups.csv", function (csv) {
                        console.log("loaded criteriaGroups.csv");
                        criteriaGroupsCSV = csv;
                    }), $.get("pages/data/edges.csv", function (csv) {
                        console.log("loaded edges.csv");
                        edgeCSV = csv;
                    }), $.get("pages/data/criteriaValues.csv", function (csv) {
                        console.log("loaded criteriaValues.csv");
                        constraintCSV = csv;
                    })).then(function () {
                        //parse Edges
                        var lines = myutils.parseCSV(edgeCSV, ",");
                        for (var i = 1; i < lines.length; i++)
                            if (lines[i].length > 2)
                                data.addEdge(lines[i][1], lines[i][2], lines[i][0]);

                        //parse criteriaGroups (this orders them)
                        var newcriteria = [];
                        lines = myutils.parseCSV(criteriaGroupsCSV, ",");
                        for (var i = 1; i < lines.length; i++)
                            if (lines[i].length > 0) {
                                var line = lines[i];
                                var group = data.criteria[line[0]];
                                if (!group)
                                    console.warn("Failed to reference content of criteriaGroup " + line[0]);
                                if (line.length > 1)
                                    group.description = line[1];
                                newcriteria.push(data.criteria[line[0]]);
                            }
                        data.criteria = newcriteria;

                        //parse Constraints/criteriaValues
                        //note the Criteria(Ids) of criteria.csv must match the columns of criteriaValues.csv perfectly
                        lines = myutils.parseCSV(constraintCSV);
                        var criteria = {};
                        //make it easier to access/loop the criteria
                        for (var i = 0; i < data.criteria.length; i++)
                            for (var j = 0; j < data.criteria[i].constraints.length; j++) {
                                var constraint = data.criteria[i].constraints[j]
                                criteria[constraint.title] = constraint;
                            }

                        var constraints = {};
                        var cols = {};
                        for (var i = 0; i < lines[0].length; i++)
                            cols[lines[0][i]] = i;
                        for (var i = 1; i < lines.length; i++)
                            if (lines[i] && lines[i].length > 0) {
                                var constraint = {};
                                Object.keys(criteria).forEach(function (criteriaId) {
                                    if (!lines[i][cols[criteriaId]])
                                        return;
                                    //values is a criteriaValues.csv cell (which can containt a list of allowed values)                                   
                                    var values = parseConstraintValues(lines[i][cols[criteriaId]]); //remove brackets and split
                                    var goodValues = [];
                                    for (var j = 0; j < values.length; j++) {
                                        var value = values[j];
                                        if (value.length > 0 && value !== "-") {
                                            goodValues.push(value);
                                            if (criteria[criteriaId].values.indexOf(value) === -1)
                                                criteria[criteriaId].values.push(value);
                                        }
                                    }
                                    constraint[criteria[criteriaId].title] = goodValues;
                                });
                                constraints[lines[i][0]] = constraint;//column 0 is id 

                                if (lines[i][2])
                                    data.findById(lines[i][0]).manualizable = true;
                            }
                        data.constraints = constraints;

                        console.log(data);
                    });
                    console.log("getting the freshest data");
                    return  function (callback) {
                        allDone.then(function () {
                            try {
                                callback(data);
                            } catch (err) {
                                console.log(err);
                            }
                        });
                    };
                }]);

    //the withGraph service just makes a "generic graph", this one now does some one time transformations
    //to make the datastructure easier digestible for the visualization
    angular.module('myApp.services')
            .factory('convertGraph', [function () {
                    return function (graph) {

                        var nodes = graph.nodes;
                        function id(node) {
                            return node.id;
                        }

                        var activityCache = {};
                        var activityGroups = [];
                        function newActivity(node) {
                            var cpy = {id: node.id, edges: {}};
                            if (node.manualizable)
                                cpy.manualizable = true;
                            activityCache[node.id] = cpy;

                            //the uniq is just for "better safe than sorry"
                            cpy.inArtifacts = uniq(graph.getInNodes(node, 'input').map(id));
                            cpy.outArtifacts = uniq(graph.getOutNodes(node, 'output').map(id));
                            cpy.roles = uniq(graph.getOutNodes(node, 'role').map(id));
                            cpy.tools = uniq(graph.getOutNodes(node, 'tool').map(id));
                            cpy.prevs = uniq(graph.getInNodes(node, 'require').map(id));
                            cpy.nexts = uniq(graph.getOutNodes(node, 'require').map(id));
                            cpy.parents = uniq(graph.getInNodes(node, 'inherit').map(id));
                            cpy.children = uniq(graph.getOutNodes(node, 'inherit').map(id));
                            cpy.activity = {id: node.id};

                            for (var j = 0; j < UIProps.length; j++)
                                cpy[UIProps[j]] = convertIdArrToObjArr(cpy[IDProps[j]], cpy.id);

                            return cpy;
                        }
                        //the UI props are actual objects representing nodes, with x,y coordinates, width,..
                        var UIProps = [
                            'uiInArtifacts',
                            'uiOutArtifacts',
                            'uiRoles',
                            'uiTools',
                            'uiNexts',
                            'uiPrevs',
                            'uiChildren',
                            'uiParents'
                        ];
                        //the ID props are just arrays of strings, to more easily deal with references
                        var IDProps = [
                            'inArtifacts',
                            'outArtifacts',
                            'roles',
                            'tools',
                            'nexts',
                            'prevs',
                            'children',
                            'parents'
                        ];
                        for (var i = 0; i < nodes.length; i++)
                            if (nodes[i].isActivity)
                                newActivity(nodes[i]);

                        function uniq(a) {
                            var seen = {};
                            return a.filter(function (item) {
                                return seen.hasOwnProperty(item) ? false : (seen[item] = true);
                            });
                        }

                        function convertIdArrToObjArr(arr, parent) {
                            var res = [];
                            for (var i = 0; i < arr.length; i++)
                                res[i] = {id: arr[i], parent: parent};
                            return res;
                        }

                        var newGraph = {
                            allNodes: activityCache,
                            labels: graph.labels,
                            details: graph.details,
                            htmlDetails: graph.htmlDetails,
//                            getSequence: function (startId) {
//                                var all = this.allNodes;
//                                var current = all[startId];
//                                var visited = {};
//                                var newnodes = [];
//                                while (current) {
//                                    newnodes.push(current);
//                                    visited[current.id] = true;
//                                    var next = null;
//                                    for (var i = 0; i < current.uiNexts.length; i++)
//                                        if (!visited[current.uiNexts[i].id]) {
//                                            next = all[current.uiNexts[i].id];
//                                            break;
//                                        }
//                                    current = next;
//                                    if (!current) {
//                                        Object.keys(all).forEach(function (id) {
//                                            if (!visited[id] && !current)
//                                                current = all[id];
//                                        });
//                                    }
//                                }
//                                return newnodes;
//                            }
                            getSequence: function (startId) {//ignored
                                var all = this.allNodes;
                                console.log(all)
                                console.log(Object.keys(this.allNodes))
                                console.log(Object.keys(this.allNodes).sort())
                                return Object.keys(this.allNodes).sort().map(function (key) {
                                    return all[key];
                                });
                            }
                        }
                        console.log(JSON.stringify(activityGroups[0]));
                        return newGraph;
                    };
                }]);
}
());
