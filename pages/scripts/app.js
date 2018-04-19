(function () {
    'use strict';

    // create the angular app
    var myApp = angular.module('myApp', [
        'myApp.controllers',
        'myApp.directives',
        'myApp.services',
        'ngSanitize',
        'ngRoute'
    ]);

    // setup dependency injection
    angular.module('d3', []);
    angular.module('myApp.services', []);
    angular.module('myApp.controllers', ['myApp.services']);
    angular.module('myApp.directives', ['d3']);

    myApp.config(function ($routeProvider) {
        $routeProvider
                .when('/', {
                    templateUrl: 'pages/activities.html'
                })
                .when('/activities', {
                    templateUrl: 'pages/activities.html'
                })
                .when('/artifacts', {
                    templateUrl: 'pages/artifacts.html'
                })
                .when('/roles', {
                    templateUrl: 'pages/roles.html'
                })
                .when('/tools', {
                    templateUrl: 'pages/tools.html'
                })
                .when('/overview', {
                    templateUrl: 'pages/overview.html',
                    controller: 'overviewController'
                })
                .when('/configure', {
                    templateUrl: 'pages/configure.html',
                    controller: 'configureController'
                });
    });


}());