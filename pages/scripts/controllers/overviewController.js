(function () {
    'use strict';
    angular.module('myApp.controllers')
            .controller('overviewController', ['$scope', 'withGraph', 'convertGraph', function ($scope, withGraph, convertGraph) {
                    console.log($scope.MAGIC + "MAGIC");

                    console.log("overview");
                    $scope.d3Data = {
                        nodes: [],
                        edges: [],
                        labels: {},
                        htmlDetails : {}                        
                    };

                    withGraph(function (data) {
                        $scope.$apply(function () {
                            console.log("overview data");

                            var newdata = convertGraph(data);
                            newdata.nodes = newdata.getSequence("ACT-WP1-01");
                            $scope.d3Data = newdata;

                            console.log(data);

                            $scope.showDetails = false;

//                            $scope.selectedNodeId = "ACT-WP1-01";
//                            $scope.selectedNodeStyle = "panel activity";
//                            $scope.selectedNodeYOffset = 800;
                        });
                    });

                    $scope.d3OnClick = function (item) {
                        $scope.showDetails = item && item.id;
                        if ($scope.showDetails) {
                            if ($scope.selectedNodeId !== item.id)
                                $scope.selectedNodeId = item.id;
                            if (item.style)
                                $scope.selectedNodeStyle = "panel " + item.style;
                            if (item.y) {
                                var div = $('#graphMainDiv');
                                var height = div.height();
                                var width = div.width();
                                //borders get wierd without trunc
                                $scope.selectedNodeYOffset = Math.trunc(item.y - height);
                                //800, 400 are from the divs max-width, computing the width in case it is smaller is not probably not woth it
                                $scope.selectedNodeXOffset = Math.trunc(Math.max(15, Math.min(width - 800, item.x - 400)));

                            }
                        }

                    };

                }]);
}
());
