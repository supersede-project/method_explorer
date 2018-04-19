(function () {
    'use strict';
    angular.module('myApp.controllers')
            .controller('configureController', ['$scope', 'withGraph', 'convertGraph', 'pdfGen', function ($scope, withGraph, convertGraph, pdfGen) {
                    console.log($scope.MAGIC + "MAGIC");
                    console.log("configure");
                    $scope.d3Data = {
                        nodes: [],
                        edges: []};
                    $scope.d3OnClick = function (item) {
                        //do nothing when clicking on something in the svg
                    }

                    $scope.downloadPdf = function (item) {
                        pdfGen($scope.d3Data, $scope.d3ConstraintValue);
                    }

                    function toTitle(string) {
                        //trim spaces and newlines
                        return string.replace(/^\s+|\s+$/gm, '').replace("\n", '');
                    }
                    function toId(string) {
                        //turn sequences of non characters to one _
                        return toTitle(string).replace(/\W+/g, '_').toLowerCase();
                    }

                    $scope.pages = [];
                    $scope.currentPage = {};
                    $scope.paginate = function (page) {
                        $scope.currentPage = page;
                    }
                    $scope.paginateNext = function () {
                        console.log("NEXT")
                        var idx = $scope.pages.indexOf($scope.currentPage);
                        if (idx + 1 < $scope.pages.length)
                            $scope.currentPage = $scope.pages[idx + 1];
                    }
                    $scope.paginatePrev = function () {
                        console.log("PREV")
                        var idx = $scope.pages.indexOf($scope.currentPage);
                        if (idx > 0)
                            $scope.currentPage = $scope.pages[idx - 1];
                    }

                    var conditions = {};

                    $scope.onConstraintChange = function (fuckery,constraintId,valueId) {
                        console.log(constraintId, valueId);                        
                        var c = $scope.d3ConstraintValue;
                        
                              console.log(c[constraintId][valueId]);  
                        if(fuckery && c[constraintId][valueId]){
//                            delete c[constraintId][valueId];                            
                        }
                        
                        var res = "";
                        res = Object.keys(c).reduce(function (acc, cur) {
                            return acc + "" + cur + ":[" +
                                    Object.keys(c[cur]).reduce(function (acc2, cur2) {
                                return acc2 + ((c[cur][cur2])?" " + cur2:"");
                            }, "") + " ] ";
                        }, "");
                        res += "\n";

                        res += "Visible ";

                        Object.keys(conditions).forEach(function (key) {
                            //conditions can print their "reasoning", here it's enabled for ACT-WP1-01
                            var val = conditions[key](key === "ACT-WP1-01") || false;
                            if (val)
                                res += key + " ";
                            $scope.d3Data.allNodes[key].removed = !val;
                            if ($scope.d3Data.allNodes[key].manualizable && !val)
                                $scope.d3Data.allNodes[key].activity.prefix = "Manual: ";
                            else
                                delete $scope.d3Data.allNodes[key].activity.prefix;
                        });
                        console.log($scope.d3Data);
                        $scope.d3Data.nodes = $scope.d3Data.getSequence("ACT-WP1-01").filter(function (d) {
                            return !d.removed || d.manualizable;
                        });
                        console.log(res + "\n");
                        console.log(constraintId, valueId);                             
                        console.log(c[constraintId][valueId]);  

                    };

                    console.log($scope.d3Constraint);
                    console.log($scope.d3Value);


                    withGraph(function (data) {
                        $scope.$apply(function () {
                            var criteria = data.criteria;

                            $scope.d3ConstraintData = criteria;
                            $scope.d3ConstraintValue = {}; //the current value of the constraint
                            $scope.d3ConstraintValues = {}; //all the possible values of the constraint 

                            //seamlessly using the same data structure for comboboxes and checkboxes requires
                            // MaGiC *fairydance*, be very careful. things having the same reference here is important
                            for (var i = 0; i < criteria.length; i++) {
                                var group = criteria[i];
                                for (var j = 0; j < group.constraints.length; j++) {
                                    var constraint = group.constraints[j];
                                    constraint.id = constraint.title;
                                    constraint.uivalues = [];
                                    var val = {};
                                    for (var k = 0; k < constraint.values.length; k++) {
                                        var value = constraint.values[k];
                                        constraint.uivalues[k] = {id: value, text: value};
                                        var obj = {};
                                        obj[value] = true;
                                        val[value] = obj;
                                    }
                                    $scope.d3ConstraintValue[constraint.id] = val[constraint.uivalues[0].id];
                                    $scope.d3ConstraintValues[constraint.id] = val;
                                    if (constraint.uivalues.length === 1)
                                        constraint.isMulti = true;
                                }
                            }
                            $scope.currentPage = criteria[0];
                            $scope.pages = criteria.slice();
                            $scope.pages.push('END');

                            var newdata = convertGraph(data);
                            newdata.nodes = newdata.getSequence("ACT-WP1-01");
                            $scope.d3Data = newdata;

                            //initialize conditions
                            //ie. actually use the constraints/criteriaValues for computation
                            Object.keys(data.constraints).forEach(function (actId) {
                                var id = actId;
                                conditions[id] = function (print) {
                                    var actConstraints = data.constraints[id];
                                    if (print) {
                                        console.log("XXX");
                                        console.log(actConstraints);
                                    }
                                    return Object.keys(actConstraints).every(function (constraintId) {
                                        var actConstraint = actConstraints[constraintId];
                                        var curConstraint = $scope.d3ConstraintValue[constraintId];
                                        if (print) {
                                            console.log("---" + constraintId);
                                            console.log(actConstraint);
                                            console.log(curConstraint);
                                        }
                                        return actConstraint.length === 0 ||
                                                Object.keys(curConstraint).some(function (curValue) {
                                            return actConstraint.indexOf(curValue) !== -1 && curConstraint[curValue];
                                        });
                                    });
                                };
                            });

                            console.log("SDADSASDASD")
                            console.log(conditions)

                            //initialize initial, don't forget to uncomment.
                            //$scope.onConstraintChange();

                        });
                    });

                }]);
}
());
