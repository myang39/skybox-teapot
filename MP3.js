
var gl;
var canvas;

var shaderProgram;
//store the texture coords for the mesh
var cubeTCoordBuffer;
//terrain geometry
var cubeVertexBuffer;
// Create a place to store the triangles
var cubeTriIndexBuffer;

//ModelView matrix
var mvMatrix = mat4.create();

//Projection matrix
var pMatrix = mat4.create();

//Normal matrix
var nMatrix = mat3.create();

var mvMatrixStack = [];

//store the texture
var cubeTexture;

// View parameters
var eyePt = vec3.fromValues(0.0,0.0,10.0);
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);
var globalQuat = quat.create();

// For animation 
var then =0;
var modelXRotationRadians = degToRad(0);
var modelYRotationRadians = degToRad(0);
var modelZRotationRadians = degToRad(-60);

// ready variable
ready_to_draw = false;


//Pass the model view matrix to the shader program
function uploadModelViewMatrixToShader() {
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//Pass the projection matrix to the shader program
function uploadProjectionMatrixToShader() {
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
}

//Pass the normal matrix to the shader program
function uploadNormalMatrixToShader() {
    mat3.fromMat4(nMatrix,mvMatrix);
    mat3.transpose(nMatrix,nMatrix);
    mat3.invert(nMatrix,nMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//Phong Lighting Model
function uploadLightsToShader(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//Pass the view direction vector to the shader program
function uploadViewDirToShader(){
	gl.uniform3fv(gl.getUniformLocation(shaderProgram, "viewDir"), viewDir);
}

//Pass the rotation matrix to the shader program so that reflections work as the teapot spins
function uploadRotateMatrixToShader(rotateMat){
	gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "uRotateMat"), false, rotateMat);
}

//Push current MV matrix to stack for hieroarchial modeling
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//Pop stored MV matrix from stack for hieroarchial modeling
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
    	throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//Call subroutines to upload model matricies to shader program
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
	uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//Convert deg to radi
function degToRad(degrees) {
	return degrees * Math.PI / 180;
}

//Create a WebGL context upon startup
function createGLContext(canvas) {
	var names = ["webgl", "experimental-webgl"];
	var context = null;
	for (var i=0; i < names.length; i++) {
		try {
		  context = canvas.getContext(names[i]);
		} catch(e) {}
		if (context) {
		  break;
		}
	}
	if (context) {
		context.viewportWidth = canvas.width;
		context.viewportHeight = canvas.height;
	} else {
		alert("Failed to create WebGL context!");
	}
	return context;
}

//Load shader from document
function loadShaderFromDOM(id) {
	var shaderScript = document.getElementById(id);
	if (!shaderScript) {
		return null;
	}
	var shaderSource = "";
	var currentChild = shaderScript.firstChild;
	while (currentChild) {
		if (currentChild.nodeType == 3) {
			shaderSource += currentChild.textContent;
		}
		currentChild = currentChild.nextSibling;
	}

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	} 
	return shader;
}

//Pass bool variable to shader program. Shading color is different for the teapot and the skybox, so it is necessary to switch between the settings when shading.
function switchShaders(isSkybox){
	gl.uniform1f(gl.getUniformLocation(shaderProgram, "uIsSkybox"), isSkybox);
}

//Set up shader programs upon startup
function setupShaders() {
	vertexShader = loadShaderFromDOM("shader-vs");
	fragmentShader = loadShaderFromDOM("shader-fs");

	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert("Failed to setup shaders");
	}

	gl.useProgram(shaderProgram);

	// Enable vertex position
	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
	console.log("Vertex attrib: ", shaderProgram.vertexPositionAttribute);
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	
	// Enable vertex normals
    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

	// Enable matrix manipulations
	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
	
	// Enable Phong Shading options
	shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
	shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
	shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
	shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
	shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
}

//Setup the draw buffers for the teapot and skybox
function setupBuffers(){
    setup_cude_world();
	readTextFile("teapot_0.obj", setupTeapotBuffers);
}

//Setup the cubemap texture for the skybox and teapot.
function setupCubeMap() {
    // Initialize the Cube Map, and set its parameters
    cubeTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture); 
	
	// Set texture parameters
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, 
          gl.LINEAR); 
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER,    
          gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    
    // Load up each cube map face
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X, cubeTexture, 'pos-x1.png');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, cubeTexture, 'neg-x1.png');    
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, cubeTexture, 'pos-y1.png');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, cubeTexture, 'neg-y1.png');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, cubeTexture, 'pos-z1.png');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, cubeTexture, 'neg-z1.png'); 
}

//Bind images to a specific side of the cubemap
function loadCubeMapFace(gl, target, texture, url){
    var image = new Image();
    image.onload = function()
    {
    	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
        gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    image.src = url;
}



//Check if minification by checking if there are both power of 2
function check_minification(value1, value2) {
	return (value1 & (value1 - 1))==0 && (value2 & (value2 - 1)) ==0;
}

//Load the image to a face of the cubemap.
//size or not and then acts correspondingly
function handleTextureLoaded(image, texture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
	//check whether there will be a minification, if there is
	//
  if (check_minification(image.width, image.height)) {
	  //mipmap
     gl.generateMipmap(gl.TEXTURE_2D);
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  } else {
	  // Wrapping mode to clamp edge
     gl.texParameteri(gl.TETXURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
     gl.texParameteri(gl.TETXURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
     gl.texParameteri(gl.TETXURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
	//make the highest quality filtering
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

//Set camera location and view direction, also help to render the skybox and teapot
function draw() { 
    var translateVec = vec3.create();
    var scaleVec = vec3.create();
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    mat4.perspective(pMatrix,degToRad(90), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);
 
    // Setup the scene and camera
    mvPushMatrix();
	var rotateMat = mat4.create();
	mat4.rotateY(rotateMat, rotateMat, modelYRotationRadians);
	mat4.rotateX(rotateMat, rotateMat, modelXRotationRadians);
	mat4.rotateZ(rotateMat, rotateMat, modelZRotationRadians);
	uploadRotateMatrixToShader(rotateMat);
    vec3.set(translateVec,0.0,0.0,-10.0);
    mat4.translate(mvMatrix, mvMatrix,translateVec);
    setMatrixUniforms();
	
    vec3.add(viewPt, eyePt, viewDir);
    mat4.lookAt(mvMatrix,eyePt,viewPt,up);
	// Setup lights
	uploadLightsToShader([0,25,0],[0.0,0.0,0.0],[0.2,0.2,0.2],[0.25,0.25,0.25]);
	
	// render the skybox
    drawSkybox();
	// if the teapot has been successfully read in, render the teapot
	if (ready_to_draw){
		mat4.rotateY(mvMatrix,mvMatrix,modelYRotationRadians);
		mat4.rotateX(mvMatrix,mvMatrix,modelXRotationRadians);
		mat4.rotateZ(mvMatrix,mvMatrix,modelZRotationRadians);
		drawTeapot();
	}
    mvPopMatrix();
  
}


//my animate function: rotate
function animate() {
    if (then==0)
    {
    	then = Date.now();
    }
    else
    {
		now=Date.now() * 0.003;
		// Remember the current time.
		then = now;  
    }
}



//Doing the initialization work of the program and kicking off the animation callback
function startup() {
	canvas = document.getElementById("myGLCanvas");
	gl = createGLContext(canvas);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
	document.onkeydown = handleKeyDown;
	setupShaders();
	setupBuffers();
	setupCubeMap();
	tick();
}

//Callback function to perform draw each frame
function tick() {
    requestAnimFrame(tick);
    draw();
    animate();
}

//Function to setup the vertex and tri-index buffers for the skybox cube.

function setup_cude_world() {

  // Create a buffer for the cube's vertic.
  cubeVertexBuffer = gl.createBuffer();

  // Select the cubeverticBuffer as the one to apply vertex
  // operations to from here out.
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);

  // Now create an array of vertic for the cube.
  var vertic = [
    // Front face
    -50.0, -50.0,  50.0,
     50.0, -50.0,  50.0,
     50.0,  50.0,  50.0,
    -50.0,  50.0,  50.0,

    // Back face
    -50.0, -50.0, -50.0,
    -50.0,  50.0, -50.0,
     50.0,  50.0, -50.0,
     50.0, -50.0, -50.0,

    // Top face
    -50.0,  50.0, -50.0,
    -50.0,  50.0,  50.0,
     50.0,  50.0,  50.0,
     50.0,  50.0, -50.0,

    // Bottom face
    -50.0, -50.0, -50.0,
     50.0, -50.0, -50.0,
     50.0, -50.0,  50.0,
    -50.0, -50.0,  50.0,

    // Right face
     50.0, -50.0, -50.0,
     50.0,  50.0, -50.0,
     50.0,  50.0,  50.0,
     50.0, -50.0,  50.0,

    // Left face
    -50.0, -50.0, -50.0,
    -50.0, -50.0,  50.0,
    -50.0,  50.0,  50.0,
    -50.0,  50.0, -50.0
  ];

  // Now pass the list of vertic into WebGL to build the shape. We
  // do this by creating a Float32Array from the JavaScript array,
  // then use it to fill the current vertex buffer.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertic), gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertic.
  cubeTriIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.
  var cubeVertexIndices = [ 
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23    // left
  ]

  // Now send the element array to GL
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
}

// Helper function to draw() routine to set the vertex positions before drawing the 
//    skybox for each frame. Also switches the shader to the skybox settings.
function drawSkybox(){
  switchShaders(true);
	
	// Draw the cube by binding the array buffer to the cube's vertic
	// array, setting attributes, and pushing it to GL.
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
	
	// Draw the cube by binding the array buffer to the cube's vertic
	// array, setting attributes, and pushing it to GL.
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

	// Specify the texture to map onto the face.
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
	gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 0);

	// Draw the cube.
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);
	setMatrixUniforms();
	gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}
//Get file from the server for processing on the client side.
function readTextFile(file, callbackFunction)
{
    console.log("reading "+ file);
    var rawFile = new XMLHttpRequest();
    var allText = [];
    rawFile.open("GET", file, true);
    
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                 callbackFunction(rawFile.responseText);
                 console.log("Got text file!");
                 
            }
        }
    }
    rawFile.send(null);
}

var vertical_axis = vec3.fromValues(0.0, 1.0, 0.0);
var eyepoint = vec3.fromValues(0.0,0.0,10.0);

//Function which adds a new rotation around a given axis to the global quaternion 
function quatRotation(rotationRate, rotAxis){
    // create a new quaternion to apply new rotation
    var tempQuat = quat.create();
    quat.setAxisAngle(tempQuat, rotAxis, rotationRate);
    quat.normalize(tempQuat, tempQuat);
    
    // apply new rotation to global quaternion
    quat.multiply(globalQuat, tempQuat, globalQuat);
    quat.normalize(globalQuat, globalQuat);
}

//Function to handle user input (from arrow keys)
function handleKeyDown(event){
	// A:orbit left
    if (event.keyCode == 65){
        quatRotation(-0.06, vertical_axis);
        
        vec3.transformQuat(eyePt, eyepoint, globalQuat);
		vec3.normalize(viewDir, eyePt);
		vec3.scale(viewDir, viewDir, -1);
    }
    // D:orbit right
    else if (event.keyCode == 68){
        quatRotation(0.06, vertical_axis);
       
        vec3.transformQuat(eyePt, eyepoint, globalQuat);
		vec3.normalize(viewDir, eyePt);
		vec3.scale(viewDir, viewDir, -1);
    }
	//f
	else if (event.keyCode == 70){
		var temp=vec3.create();
		vec3.cross(temp, viewDir, vertical_axis);
        quatRotation(-0.06, temp);
       
        vec3.transformQuat(eyePt, eyepoint, globalQuat);
		vec3.normalize(viewDir, eyePt);
		vec3.scale(viewDir, viewDir, -1);
    }
	//g
	else if (event.keyCode == 71){
		var temp=vec3.create();
		vec3.cross(temp, viewDir, vertical_axis);
        quatRotation(0.06, temp);
       
        vec3.transformQuat(eyePt, eyepoint, globalQuat);
		vec3.normalize(viewDir, eyePt);
		vec3.scale(viewDir, viewDir, -1);
    }
	
	
	// W:rotate teapot right
	else if (event.keyCode == 87){
		modelYRotationRadians += 0.06;
	}
	// S:Rotate teapot left
	else if (event.keyCode == 83){
		modelYRotationRadians -= 0.06;
	}
	//up arrow key: rotate front for teapot
	else if (event.keyCode == 38) {
		modelXRotationRadians += 0.06;
	}
	//down arrow key: rotate back for teapot
	else if (event.keyCode == 40) {
		modelXRotationRadians -= 0.06;
	}
	//right arrow key: rotate counter-clock wise  for teapot
	else if (event.keyCode == 39) {
		modelZRotationRadians += 0.06;
	}
	//left arrow key: rotate clock-wise for teapot
	else if (event.keyCode == 37) {
		modelZRotationRadians -= 0.06;
	}
}

var TPvertex_buffer;
var TPvertexnormal_buffer;
var TP_indexbuffer;

//load teapot obj file. calculate normal
function setupTeapotBuffers(raw_file_text){
	var vertic = [];
	var face = [];
	vertics_counter = 0;
	face_counter = 0;
	
	// read vertex and face data
	var lines = raw_file_text.split("\n");
	for (var line_num in lines){
		list_elements = lines[line_num].split(' ');
		
		// line corresponds to vertex information
		if (list_elements[0] == 'v'){
			//cast to fload
			vertic.push(parseFloat(list_elements[1]));
			vertic.push(parseFloat(list_elements[2]));
			vertic.push(parseFloat(list_elements[3]));
			vertics_counter += 1;
		}
		// line corresponds to face information
		else if(list_elements[0] == 'f'){
			//cast to int
			face.push(parseInt(list_elements[2])-1);
			face.push(parseInt(list_elements[3])-1);
			face.push(parseInt(list_elements[4])-1);
			face_counter += 1;
		}
	}
	
	// bind vertex data
	TPvertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, TPvertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertic), gl.STATIC_DRAW);
	TPvertex_buffer.numItems = vertics_counter;
	
	// calculate normals
	var normals = [];
	for (var i=0; i < vertics_counter; i++){
		normals.push(0);
		normals.push(0);
		normals.push(0);
	}
	// Calculate vertex normals
	normal_getter(vertic, face, face_counter, vertics_counter, normals);
	// bind normal data
	TPvertexnormal_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, TPvertexnormal_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    TPvertexnormal_buffer.itemSize = 3;
    TPvertexnormal_buffer.numItems = face_counter;
	
	// bind face data
    TP_indexbuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, TP_indexbuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(face), gl.STATIC_DRAW);
	TP_indexbuffer.numItems = face_counter;
	
	ready_to_draw = true;
}

//Helper function to draw() routine to set the vertex positions and vertex normals before
//   drawing the teapot for each frame. Also switches the shader to the teapot settings.
function drawTeapot(){
	switchShaders(false);
	uploadViewDirToShader()
	
	// Draw the cube by binding the array buffer to the cube's vertic
	// array, setting attributes, and pushing it to GL.
	gl.bindBuffer(gl.ARRAY_BUFFER, TPvertex_buffer);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
		
	gl.bindBuffer(gl.ARRAY_BUFFER, TPvertexnormal_buffer);
	gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);  

	// Draw the cube.
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, TP_indexbuffer);
	setMatrixUniforms();
	gl.drawElements(gl.TRIANGLES, 6768, gl.UNSIGNED_SHORT, 0);
}

//function:
//purpose: calculate the vertex normals. 
//By Averaging the normals of surface of each face, we get the normal of each vertex.
function normal_getter(vertic, face, numT, numV, normals){
    var faceNormals = [];
    
    for (var i = 0; i < numT; i++){
        var v1 = face[i*3];
        var v2 = face[i*3 + 1];
        var v3 = face[i*3 + 2];
        
        var vector1 = vec3.fromValues(vertic[3*v2]-vertic[3*v1], vertic[3*v2+1]-vertic[3*v1+1], vertic[3*v2+2]-vertic[3*v1+2]);
        var vector2 = vec3.fromValues(vertic[3*v3]-vertic[3*v1], vertic[3*v3+1]-vertic[3*v1+1], vertic[3*v3+2]-vertic[3*v1+2]);
        var normal = vec3.create();
        vec3.cross(normal, vector1, vector2);
		
        faceNormals.push(normal[0]);
        faceNormals.push(normal[1]);
        faceNormals.push(normal[2]);
    }
	    
    var count = [];
    for (var i = 0; i < numV; i++)
        count.push(0);
    
    //Sums up of the surface normal vectors
    normal_getter_helper( face, numT, normals, count, faceNormals);
    // average normal vector in normalsNormalBuffer
    // In normals Buffer, normalize each normal vector
    for (var i = 0; i < numV; i++){
        // for each point, average adjacent surface normal vectors
		for(var j = 0; j < 3; j++){
			normals[3*i+j] = normals[3*i+j]/count[i];
		}
        // normalize normal vector
        var normal = vec3.fromValues(normals[i*3+0], normals[i*3+1], normals[i*3+2]);
        var normalized = vec3.create();
        vec3.normalize(normalized, normal);
        
        // store
		for(var j = 0; j < 3; j++){
			normals[i*3+j] = normalized[j];
		}
    }
}
//helper function for normal_getter
//sums up all normal vectors on the surface
function normal_getter_helper( face, numT, normals, count, faceNormals){
	for (var i = 0; i < numT; i++){
        var v1 = face[i*3 + 0];
        var v2 = face[i*3 + 1];
        var v3 = face[i*3 + 2];
        // iterate over each vertex in triangle
        count[v1] += 1;
        count[v2] += 1;
        count[v3] += 1;
        for(var j = 0 ; j < 3; j++){
			normals[3*v1 + j] += faceNormals[i*3 + j];
			normals[3*v2 + j] += faceNormals[i*3 + j];
			normals[3*v3 + j] += faceNormals[i*3 + j];
		}
    }  
}

