(function () {
    'use strict';
    var orange = "#ff6600";
    angular.module('myApp.services')
            .factory('pdfGen', ['myutils', function (myutils) {

                    function replaceLinks(text) {
                        var text2 = "";
                        myutils.interlinkMapper(text, function (text) {
                            text2 += text;
                        });
                        var res = [];
                        myutils.linkMapper(text2, function (text, link) {
                            if (link)
                                res.push({text: text, link: link, color: 'blue', noWrap: true});
                            else
                                res.push({text: text});
                        });
                        return {text: res};
                    }

                    return  function (data, constraintValue) {
                        var content = []
                        function add(e) {
                            content.push(e);
                        }
                        function addNewline() {
                            content.push({text: '\n'});
                        }
                        var docDefinition = {
                            content: content,
                            styles: {
                                superHeader: {
                                    fontSize: 32,
                                    color: orange,
                                    bold: true,
                                    alignment: 'center'
                                },
                                criteriaHeader: {
                                    fontSize: 12,
                                    color: orange,
                                    bold: false,
                                    alignment: 'left'
                                },
                                criteriaValue: {
                                    fontSize: 12,
                                    bold: false,
                                    alignment: 'left'
                                },
                                chapterNumber: {
                                    fontSize: 52,
                                    color: '#ed7d31',
                                    bold: true
                                },
                                chapterHeader: {
                                    fontSize: 32,
                                    color: orange,
                                    bold: true
                                },
                                subChapterHeader: {
                                    fontSize: 24,
                                    color: '#ed7d31',
                                    bold: true
                                },
                                elementHeader: {
                                    fontSize: 15,
//                                    color: orange,
                                    bold: true
                                },
                                listHeader: {
                                    fontSize: 14,
                                    italics: true
                                }
                            },
                            pageBreakBefore: function (currentNode, followingNodesOnPage, nodesOnNextPage, previousNodesOnPage) {
                                return currentNode.id === "introbegin" || currentNode.id === "method" || currentNode.id === "guide";
                            }
                        };
                        add(headerTable());
                        addNewline();
                        add(headerImage());
                        add({text: 'Tailored Method Manual', style: 'superHeader', alignment: 'center'});
                        addNewline();
                        addNewline();
                        addNewline();
                        var criteriaTable = [];
                        add({table: {
                                widths: [60, 140, '*'],
                                body: criteriaTable
                            },
                            layout: 'noBorders',
                            alignment: 'center',
                        });
                        Object.keys(constraintValue).forEach(function (criteria) {
                            var value = Object.keys(constraintValue[criteria]).reduce(function (acc, value) {
                                 if(constraintValue[criteria][value])
                                    return ((acc === "") ? "" : acc+ ", ") + value;
                                return acc;
                            }, "");
                            criteriaTable.push(
                                    [[], [{text: criteria, style: 'criteriaHeader'}],
                                        {text: value, style: 'criteriaValue'}]);
                        });
                        addNewline();
                        addNewline();
                        add(disclaimer());
                        add(introduction());
                        add(scope());

                        var nodes = data.nodes;
                        var details = data.details;
                        console.log(data);
                        var relevantActivities = [];
                        var relevantRoles = [];
                        var relevantTools = [];
                        var relevantArtefacts = [];

                        //addRelevant is then used to filter references
                        var allRelevant = {};
                        function addRelevantUniq(arr, elem) {
                            for (var i = 0; i < elem.length; i++)
                                if (arr.indexOf(elem[i]) === -1) {
                                    arr.push(elem[i]);
                                    allRelevant[elem[i]] = true;
                                }
                        }

                        for (var i = 0; i < nodes.length; i++) {
                            var node = nodes[i];
                            if (!node.removed || node.manualizable) {
                                relevantActivities.push(node.id);
                                addRelevantUniq(relevantArtefacts, node.inArtifacts);
                                addRelevantUniq(relevantArtefacts, node.outArtifacts);
                            }
                            if (!node.removed) {
                                addRelevantUniq(relevantRoles, node.roles);
                                addRelevantUniq(relevantTools, node.tools);
                            }
                        }

                        function addContentOf(key, detail) {
                            for (var i = 0; i < detail.length; i++)
                                if (detail[i][0] === key)
                                    add(replaceLinks(detail[i][1] + "\n"));
                        }

                        function addDescriptions(idArr) {
                            add({text: "\n"});
                            for (var i = 0; i < idArr.length; i++) {
                                var detail = details[idArr[i]];
                                if (detail && detail.length > 1) {
                                    add({text: detail[1][1] + "\n", style: 'elementHeader'});
                                    addContentOf("Description:", detail);
                                    addContentOf("Context:", detail);
                                    addContentOf("Situation:", detail);
                                    add({text: "\n"});
                                }
                            }
                        }

                        function addReferenceRow(arr, label, idArr) {
                            if (idArr.length === 0)
                                return;
                            var text = idArr.reduce(function (acc, val) {
                                if (allRelevant[val])
                                    return acc + ((acc) ? ", " : "") + data.labels[val];
                                return acc;
                            }, "");
                            if (text)
                                arr.push([{text: label}, {text: text}]);
                        }

                        function addActivityDescriptions(idArr) {

                            add({text: "\n"});
                            for (var i = 0; i < idArr.length; i++) {
                                var detail = details[idArr[i]];
                                var node = data.allNodes[idArr[i]];
                                if (node && detail && detail.length > 1) {
                                    add({text: detail[1][1] + "\n", style: 'elementHeader'});
                                    addContentOf("Description:", detail);
                                    addContentOf("Context:", detail);
                                    addContentOf("Situation:", detail);

                                    var rows = [];
                                    addReferenceRow(rows, "Roles:", node.roles);
                                    addReferenceRow(rows, "Input:", node.inArtifacts);
                                    addReferenceRow(rows, "Output:", node.outArtifacts);
                                    addReferenceRow(rows, "Tools:", node.tools);

                                    if (rows.length > 0)
                                        add({table: {
                                                widths: ['auto', '*'],
                                                body: rows
                                            }
                                        });
                                    add({text: "\n"});
                                }
                            }
                        }

                        add({id: 'method',
                            text: [{text: '3 ', style: 'chapterNumber'},
                                {text: 'Tailored Method\n', style: 'chapterHeader'}]});

                        add({text: '3.1 Relevant Activities\n', style: 'subChapterHeader'});
                        addActivityDescriptions(relevantActivities);
                        add({text: '3.2 Relevant Roles\n', style: 'subChapterHeader'});
                        addDescriptions(relevantRoles);
                        add({text: '3.3 Relevant Tools\n', style: 'subChapterHeader'});
                        addDescriptions(relevantTools);
                        add({text: '3.4 Relevant Artefacts\n', style: 'subChapterHeader'});
                        addDescriptions(relevantArtefacts);


                        function addToolSetups(idArr) {
                            for (var i = 0; i < idArr.length; i++) {
                                var detail = details[idArr[i]];
                                if (detail && detail.length > 1) {
                                    add({text: detail[1][1] + "\n", style: 'elementHeader'});
                                    addContentOf("Configuration instructions:", detail);
                                    addContentOf("Configuration instructions", detail);
                                    addContentOf("Description of use:", detail);
                                    add({text: "\n"});
                                }
                            }
                        }

                        add({id: 'guide',
                            text: [{text: '4 ', style: 'chapterNumber'},
                                {text: 'Tool Setup Guidelines\n', style: 'chapterHeader'}
                            ]
                        });
                        addToolSetups(relevantActivities);

//                        for (var i = 0; i < nodes.length; i++) {
//                            var node = nodes[i];
//                            var detail = details[node.id];
//                            if (detail.length > 1)
//                                add({text: detail[0][1] + " " + detail[1][1] + "\n", style: 'elementHeader'});
//                            for (var j = 2; j < detail.length; j++) {
//                                var text = detail[j][1].replace(/<.*?>/g, "");
//                                if (text.length > 40)//.indexOf("\n") !== -1)
//                                {
//                                    add({text: detail[j][0] + " ", style: 'listHeader'});
//                                    add({
//                                        columns: [
//                                            {width: 10, text: ""},
//                                            {width: '*', text: text + "\n"}
//                                        ]});
//                                } else
//                                    add({text: [
//                                            {text: detail[j][0] + " ", style: 'listHeader'},
//                                            {text: text + "\n"}]});
//                            }
//                            add({text: "\n"});
//                            //content.push({text: subcontent});
//                        }
                        console.log(docDefinition);

                        //care! .open() does not work in IE, and chrome with AdBlock!
                        pdfMake.createPdf(docDefinition).download('Configuration.pdf');//.open(); //
                    }
                    ;
                }]);
    function headerTable() {
        return {
            table: {
                widths: ['*'],
                body: [
                    [{width: 128,
                            image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmAAAABbCAIAAABbK67AAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAuIwAALiMBeKU/dgAAA6tpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAxNS0wNS0wNFQxNzowNTowMzwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+UGl4ZWxtYXRvciAzLjMuMTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpDb21wcmVzc2lvbj41PC90aWZmOkNvbXByZXNzaW9uPgogICAgICAgICA8dGlmZjpSZXNvbHV0aW9uVW5pdD4yPC90aWZmOlJlc29sdXRpb25Vbml0PgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj4zMDA8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjMwMDwvdGlmZjpYUmVzb2x1dGlvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjYwODwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNw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'}],
                    [{text: [
                                {text: [{text: 'Project Acronym: ', bold: true}, 'SUPERSEDE\n']},
                                {text: [{text: 'Project Title: ', bold: true}, 'SUpporting evolution and adaptation of PERsonalized Software by Exploiting contextual Data and End-user feedback\n']},
                                {text: [{text: 'Call identifier: H2020-ICT-2014-1', bold: true}, '\n']},
                                {text: [{text: 'Topic: ', bold: true}, 'ICT-09-2014 Tools and Methods for Software Development\n']},
                                {text: [{text: 'Type of Action: ', bold: true}, 'Research and Innovation action\n']},
                                {text: [{text: 'Grant agreement no.: ', bold: true}, '644018\n']},
                                {text: 'http://supersede.eu', link: 'http://supersede.eu', color: 'blue', underline: true}
                            ]
                        }]
                ]
            }
        };
    }

    function headerImage() {
        return{
            alignment: 'center',
            width: 320,
            image: 'data:image/png;base64,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'
        };
    }
    function timestamp() {
        var date = new Date();
        return date.getHours() + ":" + date.getMinutes() + " on " + date.getDay() + "-" + date.getMonth() + "-" + date.getFullYear();
    }
    function disclaimer() {
        return {text: [
                {text: 'Disclaimer: ', bold: true},
                {text: 'This document has been automatically generated by a research prototype- the content is provided as-is without warranty. If you need futher assistance in adopting SUPERSEDE please contact us. ',
                    italic: true},
                {text: 'https://www.supersede.eu/contact/', link: 'https://www.supersede.eu/contact/', color: 'blue', noWrap: true},
                '\n\n',
                {text: 'Supersede Method Description, document generated on ', italic: true},
                {text: timestamp(), italic: true, color: orange},
                {text: '.\nFor more information visit: ', italic: true},
                {text: 'http://supersede.eu/method-explorer', link: 'http://supersede.eu/method-explorer', color: 'blue', noWrap: true}

            ]};
    }
    function introduction() {
        return {
            id: "introbegin",
            text: [{text: '1 ', style: 'chapterNumber'},
                {text: 'Introduction\n', style: 'chapterHeader'},
                {text: '\nThe SUPERSEDE project provides advancements in several research areas, from end-user feedback and contextual data analysis, to decision making support in software evolution and adaptation. But the major novel contribution will be in integrating methods and tools from the mentioned areas, thus providing a new solution framework for software evolution and adaptation for data-intensive applications.\n\n'},
                {text: 'The number of software applications in the form of web services, mobile apps, etc., has increased dramatically over the years and is continuing to do so. This software exploits data collected through various sensors (e.g. embedded in the environment) and online data sources. End-users can access those services using a variety of devices. Mobile technologies are on the rise and thus software services are becoming ubiquitous in our society, thereby contributing to improve citizens’ quality of life. \n\n'},
                {text: 'Software providers have difficulties on predicting the acceptance of the services and applications they deliver. The great diversity of execution contexts, with different profiles of user, changing environmental conditions, etc., makes it difficult to personalize the software to every possible situation.\n\n'},
                {text: 'The complexity in handling this type of systems turns out to offer new opportunities to software engineers. The feedback provided by users on these services and applications, and the large amount of data available when they are being executed, calls for innovative techniques to exploit them in order to overcome the challenges. This is the main motivation behind the SUPERSEDE project. \n\n'},
            ]
        };
    }

    function scope() {
        return {
            text: [{text: '2 ', style: 'chapterNumber'},
                {text: 'Scope and Purpose\n', style: 'chapterHeader'},
                {text: '\nOne of the outcomes of the SUPERSEDE project is the formulation of a method. The SUPERSEDE method drives the data-driven evolution process in a systematic way. Therefore, it needs to reconcile generality to accommodate such different types of companies (and others that potentially may be interested) and customisability, as to allow the method to be effectively adopted by a company.\n\n'},
                {text: 'As the general method covers different scenarios, different organizational types, delivery strategies, privacy requirements etc, the method can be tailored to fit the actual needs of an organization adopting SUPERSEDE. \n\n'},
                {text: 'This document provides a description of the method tailored to the needs of your company, where the specific organizational requirements have been considered.   \n\n'}
            ]
        };
    }

}());
