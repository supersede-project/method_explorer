(function () {
    'use strict';
    angular.module('myApp.controllers')
            .controller('defaultController', ['$scope', 'withGraph', '$anchorScroll', '$timeout', '$routeParams', function ($scope, withGraph, $anchorScroll, $timeout, $routeParams) {

                    $scope.routeParams = $routeParams;
                    
                    withGraph(function (data) {
                        $scope.$apply(function () {
                            $scope.d3Data = data;

                        });
                        $timeout(function () {
                            $anchorScroll();
                        }, 0);
                    });
                }])
}());
