
// This code is based on three.js, which comes with the following license:
//
// The MIT License
//
// Copyright © 2010-2024 three.js authors
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// define a few global variables
let scene;	// the scene, i.e. the collection of objects that will be rendered
let renderer;
let camera;
let raytracingShaderMaterial;
let sphere;
let cube;
let orbitControls;


init();
animate();

function init() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(
		50,	// FOV
		window.innerWidth / window.innerHeight,	// aspect ratio
		0.1,	// frustrum near plane
		500	// frustrum far plane
	);
	camera.position.z = 5;

	// boilerplate code
	renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

	// also create a boring material
	const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );

	// add a cube to the scene
	let geometry = new THREE.BoxGeometry( 1, 1, 1 );
	cube = new THREE.Mesh( geometry, material );
	cube.position.x = -1;
	// scene.add( cube );

	// this is where the raytracing magic happens
	raytracingShaderMaterial = createRaytracingShaderMaterial();

	// add a sphere to the scene
	geometry = new THREE.SphereGeometry( 10 );
	sphere = new THREE.Mesh( geometry, raytracingShaderMaterial ); 
	scene.add( sphere );
	// sphere.position.x = 1;
	
	addOrbitControls();
}

function animate() {
	requestAnimationFrame( animate );

	cube.rotation.x += 0.01;
	cube.rotation.y += 0.01;

	// sphere.position.copy(camera.position);

	renderer.render( scene, camera );
}

function createRaytracingShaderMaterial() {
	const textureLoader = new THREE.TextureLoader();
	let backgroundTexture = textureLoader.load('360-180 Glasgow University - Western Square.jpg');

	return new THREE.ShaderMaterial({
		side: THREE.DoubleSide,
		wireframe: false,
		uniforms: {
			backgroundTexture: { value: backgroundTexture }
		},
		vertexShader: `
			varying vec3 intersectionPoint;	// a "varying" is a variable that allows data to be passed between the shaders

			void main()	{
				// here, in the vertex shader, the "varying" intersectionPoint is set to a value that is specific to the pixel
				intersectionPoint = (modelMatrix * vec4(position, 1.0)).xyz;

				// boilerplate code that calculates and returns (via the variable gl_Position) the position of the vertex
  				gl_Position = projectionMatrix
					* modelViewMatrix
					* vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			precision highp float;

			#define PI 3.1415926538

			varying vec3 intersectionPoint;	// ... and here the "varying" intersectionPoint is made available in the fragment shader

			uniform sampler2D backgroundTexture;	// a "uniform" is a variable that takes the same value at all pixels

			// propagate the ray starting at position s and with direction d to the plane of the disc, 
			// given by a centre, a normalised normal, and a radius.
			// if the ray intersects the disc, s becomes the point where the ray intersects the disc;
			// returns true if the ray intersects the disc, false otherwise
			bool intersectDisc(
				inout vec3 s,	// light ray start point
				vec3 d,	// light-ray direction
				vec3 c,	// disc centre
				vec3 nHat,	// normalised normal to disc
				float r	// disc radius
			) {
				// calculate the distance in the direction of the normal from the ray start position to the disc
				float deltaN = dot(c - s, nHat);

				// is the intersection with the plane in the ray's "forward" direction?
				float dN = dot(d, nHat);

				// check if the intersection is in the ray's forward direction
				if( dN*deltaN > 0.0 ) {
					// the intersection is in the ray's forward direction
					
					// calculate the intersection point
					vec3 i = s + d/dN*deltaN;

					// check if the intersection is within the radius of the disc
					if( length(i-c) <= r ) {
						// the intersection is within the radius, so the ray intersects the disc

						// move the ray forward to the intersection point
						s = i;

						// say that an intersection happened
						return true;
					}
				}

				// say that no intersection happened
				return false;
			}

			vec4 getColorOfBackground( vec3 d ) {
				// calculate the azimuthal and polar angles of the vector d
				float l = length(d);
				float phi = atan(d.z, d.x) + PI;
				float theta = acos(d.y/l);

				// return the colour of the corresponding texel
				return texture2D(backgroundTexture, vec2(phi/(2.*PI), 1.-theta/PI));
			}

			void main() {
				// s is the current ray start point
				vec3 s = cameraPosition;

				// d is the current light-ray direction
				vec3 d = intersectionPoint - cameraPosition;

				// check if the ray intersects the disc
				vec3 nHat = vec3(1., 0., 0.);	// normalised normal to the disc
				if( intersectDisc(
					s,	// light ray start point; if the ray intersects, this will become the intersection point
					d,	// light-ray direction
					vec3(3., 0., 0.),	// disc centre
					nHat,	// normalised normal to disc
					1.	// disc radius
				) ) {
					// reflect the light-ray direction off the disc
					d = reflect(d, nHat);
				}
				
				// the variable gl_FragColor contains the colour returned by the fragment shader
				gl_FragColor = getColorOfBackground( d );
			}
		`
	});
}

function addOrbitControls() {
	orbitControls = new OrbitControls( camera, renderer.domElement );
	orbitControls.listenToKeyEvents( window ); // optional

	orbitControls.enableDamping = false; // an animation loop is required when either damping or auto-rotation are enabled
	orbitControls.dampingFactor = 0.05;

	orbitControls.enablePan = true;
	orbitControls.enableZoom = true;

	orbitControls.maxPolarAngle = Math.PI;
}
