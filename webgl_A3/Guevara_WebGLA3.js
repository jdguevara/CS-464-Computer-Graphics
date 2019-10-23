// Context and shader variables
var gl;
var shaderProgram;

// create our basic model and view matrix
var mvMatrix = mat4.create();
var mvMatrixStack = [];

// Projection matrix
var pMatrix = mat4.create();

// Geometry buffers (vertices positions, texture coordinates, indices)
var vertexPositionBuffer;
var normalVertexBuffer;
var vertexTextureCoordBuffer;
var vertexIndexBuffer;

// Texture variable
var exTexture;

// Variables for handling object rotation across each axis as well as our perspective
var xRot = 0;
var yRot = 0;
var zRot = 0;
var cameraZoom = 45;

// This helps to determine if our mouse is allowed to drag the object or not
var drag = false;

// Flag for determining when our texture is loaded (suggested by Dr. Cutchin) - JG
var imgLoaded = false;

// Camera variables for handling the speed, texture loading, view, angle, etc.
var speed;
var loaded;
var cameraView;
var cameraDirection;
var cameraAngle;
var cameraTranslate;
var cameraTip;
var cameraVMat;
var cameraImage;
var cameraNormal;

/**
 * Initialize the webGL context (A.K.A. the canvas)
 *
 * @param aname
 * @returns {CanvasRenderingContext2D | WebGLRenderingContext}
 */
function initWebGLContext(aname) {
    var canvas = document.getElementById(aname);
    gl = null;

    try {
        // Try to grab the standard context. If it fails, fallback to experimental.
        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

        // Add listeners to the canvas
        canvas.addEventListener('mousedown', canvasClick);
        canvas.addEventListener('wheel', zoom);
    }
    catch(e) {}

    // If we don't have a GL context, give up now
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
        gl = null;
    }

    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    return gl;
}

/**
 *  define the function to initial WebGL and Setup Geometry Objects
 *
 * @returns {CanvasRenderingContext2D|WebGLRenderingContext}
 */
function initGLScene() {
    // Initialize the WebGL Context - the gl engine for drawing things.
    var gl = initWebGLContext("hellowebgl"); // The id of the Canvas Element

    // This should happen if our previous context returned a null gl (i.e. failed to grab context)
    if (!gl)
    {
        return;
    }
    // succeeded in initializing WebGL system
    return gl;
}

/**
 * get the shaders needed
 *
 * @param gl
 * @param id
 * @returns {WebGLShader|null}
 */
function getShader(gl, id) {
    var shaderScript = document.getElementById(id);

    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

/**
 * Initialize shaders
 */
function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");

    // Handle the lighting
    shaderProgram.tnMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    shaderProgram.lightingDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightingDirection");
    shaderProgram.directionalColorUniform = gl.getUniformLocation(shaderProgram, "uDirectionalColor");
}

/**
 * create our projection matrix for projecting from 3D to 2D.
 */
function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

/**
 * Get the next item from our matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

/**
 * Set up uniform matrices
 */
function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);

    // lighting controls for normals
    var normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(shaderProgram.tnMatrixUniform, false, normalMatrix);
}

/**
 * create and initialize our geometry objects
 */
function initGeometry() {
    vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
    var vertices = [];
    var normalVertices = []; // Normal vertices for lighting

    // Set up 100 x 100 Grid
    for (var i = 0; i < 100; i++) {
        for (var j = 0; j < 100; j++) {
            vertices[0 + (j*3) + (i*100*3)] = (j*1.0)/50.0 - 1.0; // x-axis vertices
            vertices[1 + (j*3) + (i*100*3)] = Math.random()/10.0; // y-axis vertices
            vertices[2 + (j*3) + (i*100*3)] = (i*1.0)/50.0 - 1.0; // z-axis vertices

            normalVertices[0 + j*3 + (i*100*3)] = 0.0; // Lighting is 0 in the x-direction
            normalVertices[1 + j*3 + (i*100*3)] = 1.0; // Lighting is 1 in the y-direction
            normalVertices[2 + j*3 + (i*100*3)] = 0.0; // Lighting is 0 in the z-direction
        }
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    vertexPositionBuffer.itemSize = 3;
    vertexPositionBuffer.numItems = 100 * 100; //TODO: scaling the image may come down to making this grid the size of the image (i.e. 100x100 -> imgX x imgY)

    // Bind the normals for the light to its own buffer - JG
    normalVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalVertexBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalVertices), gl.STATIC_DRAW);
    normalVertexBuffer.itemSize = 3;
    normalVertexBuffer.numItems = 100*100;  //TODO: adjust to texture image size

    vertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexTextureCoordBuffer);
    var textureCoords = [];
    var tCount = 0;

    // Loop over the grid size -1, so as to not go "over" (should change depending on the grid/image size) - JG
    for (i = 0; i < 99; i++) {
        for (j = 0; j < 99; j++) {
            textureCoords[tCount++] = 0.0 + (j*1.0)/100.0; // X-textures (divided by grid size)
            textureCoords[tCount++] = 0.0 + (i*1.0)/100.0; // Z-textures
        }
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    vertexTextureCoordBuffer.itemSize = 2;
    vertexTextureCoordBuffer.numItems = tCount/2; // TODO: see how dividing these changes things

    vertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
    var vertexIndices = [];
    var tVertIndex = 0;

    // The indices need to just go up to the point before everything wraps
    //TODO: change the iterations to loop over the size-1 of the texture image
    for (i = 0; i < 99; i++) {
        for (j = 0; j < 99; j++) {
            vertexIndices[tVertIndex++] = j + (i*100);
            vertexIndices[tVertIndex++] = j + 1 + (i*100);
            vertexIndices[tVertIndex++] = j + ((i + 1) * 100);

            vertexIndices[tVertIndex++] = j + i*100;
            vertexIndices[tVertIndex++] = j + 1 + (i+1)*100;
            vertexIndices[tVertIndex++] = j + (i+1)*100;
        }
    }
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);
    vertexIndexBuffer.itemSize = 1;
    vertexIndexBuffer.numItems = tVertIndex;
}

/**
 * Initialize our texture data and prepare it for rendering
 */
function initTextures() {
    exTexture = gl.createTexture();
    exTexture.image = new Image();
    exTexture.image.onload = function() {
        handleLoadedTexture(exTexture)
    };

    exTexture.image.src = "box.png";
}

/**
 * What to do with our texture
 *
 * @param texture
 */
function handleLoadedTexture(texture) {
    var imgWidth = texture.image.width;
    var imgHeight = texture.image.height;
    var gridPixels = new Uint8Array(4 * imgWidth * imgHeight);
    var frameBuffer = gl.createFramebuffer();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.readPixels(0, 0, imgWidth, imgHeight, gl.RGBA, gl.UNSIGNED_BYTE, gridPixels);
    loaded = true; // This is the flag to let the machine know if the texture is loaded (would've helped in A2) - JG

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(frameBuffer);
}

/**
 * Initialize everything for starting up a simple webGL application
 */
function startHelloWebGL()
{
    // first initialize webgl components
    var gl = initGLScene();

    // Initialize variables for the camera
    speed = 0.0;
    loaded = false;
    cameraView = mat4.create();
    cameraDirection = [0.0, 0.0, 0.0]; // TODO: See how changing the Z-values by 0.1 affects the camera
    cameraAngle = 0.0; // Helps us to position the "view" of the camera
    cameraTranslate = [0.0, 0.0, 0.0]; // TODO: See how changing the Y-values by 0.1 changes the translation
    cameraTip = mat4.create();
    mat4.identity(cameraTip);
    cameraVMat = mat4.lookAt([0.0, 0.01, 0.0], [1.0, 0.01, 0.0], [0.0, 1.0, 0.0]);
    cameraImage = new Image();
    cameraNormal = [0.0, 1.0, 0.0];

    // now build basic geometry objects.
    initShaders();
    initGeometry();
    initTextures().done(function () {
        // Once done set the image loaded flag to true
        imgLoaded = true;
    });

    gl.clearColor(0.4,0.4,0.4,1.0); // Set background to sky blue - JG
    gl.enable(gl.DEPTH_TEST);

    // Add event listeners for when the mouse is no longer on our canvas prior to calling our Frames
    document.addEventListener('mouseup', canvasUnclick);
    document.addEventListener('mousemove', rotateObject);
    //TODO: Add listeners for controlling the camera, use the directional keys to move forward and backward instead of the scroll
    //TODO: Use the side keys to rotate side to side

    // TODO: Try to implement a flag that checks to see if the image for our texture has been loaded prior to drawing
    // Draw the Scene, after checking that the loaded is true
    if (imgLoaded) {
        Frames();
    }
}

/**
 * This function draws the webGL scene by doing the following:
 *      - Clearing the framebuffer
 *      - Defining the view positions for the camera using WebGL matrices
 *      - OpenGL allows the convenient method glPerspective() to be used
 *      - Call the gl draw methods to draw the defined geometry objects
 */
function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set the camera perspective
    mat4.perspective(cameraZoom, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

    // Identify the matrix to use
    mat4.identity(mvMatrix);

    // Adjust camera view
    genViewMatrix();
    mat4.multiply(mvMatrix, cameraVMat);

    // How far in each axis do we want to move the matrix points
    mat4.translate(mvMatrix, [0.0, 0.0, -5.0]);

    // Handle rotation in the specified matrices (convert to radians and specify axis)
    mat4.rotate(mvMatrix, xRot / 45.0 * 3.1415, [0, 1, 0]); // If we move our mouse in the x-direction, rotate around Y
    mat4.rotate(mvMatrix, yRot / 45.0 * 3.1415, [1, 0, 0]); // If we move our mouse in the y-direction, rotate around X

    // Bind the buffer to our context
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    // bind in the Normals for lighting
    gl.bindBuffer(gl.ARRAY_BUFFER, normalVertexBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, normalVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, vertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, exTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    gl.uniform1i(shaderProgram.useLightingUniform, true);

    // bind the texture vertex coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, vertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    // Activate texture bind it to our context and set the lighting uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, exTexture);
    gl.uniform1i(shaderProgram.useLightingUniform, true);

    // Setting up the ambience
    gl.uniform3f(
        shaderProgram.ambientColorUniform,
        // Set the RGB values to the same, that way no one light overpowers the others
        0.5,
        0.5,
        0.5
    );

    // Which way will our light come from? Well we can set it from here
    var lightingDirection = [
        0.0,
        -1.0,
        0.0
    ];

    // Adjust the color direction
    var adjustedLD = vec3.create();
    vec3.normalize(lightingDirection, adjustedLD);
    vec3.scale(adjustedLD, -1);
    gl.uniform3fv(shaderProgram.lightingDirectionUniform, adjustedLD);
    gl.uniform3f(
        shaderProgram.directionalColorUniform,
        0.0,
        2.0,
        0.0
    );

    // Finish binding lights to buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
//    mat4.translate(mvMatrix, [0.0, 0.0, 0.0]);
}

/**
 * Get the frames we need for the scene and draw them
 *
 * @constructor
 */
function Frames() {
    requestAnimFrame(Frames);
    drawScene();
}

/**
 * Sets permission for dragging our object if mouse button is clicked
 * TODO: In the event handler try to make it so that it only recognizes the left mouse button for this
 */
function canvasClick() {
    drag = true;
}

/**
 * Sets permission for draggin our object if we let go of the mouse
 */
function canvasUnclick() {
    drag = false;
}

/**
 * Handles the event of object rotation by checking if we have permission
 * and by utilizing the JavaScript movement methods
 *
 * @param event
 */
function rotateObject(event) {
    if (drag) {
        // Set the new values for our X and Y rotations
        yRot += event.movementY * 0.5;
        xRot += event.movementX * 0.5;
    }
}

/**
 * Handles the event of zooming in on our object by intercepting the wheel signal
 * and setting a limit to how close/far the object can travel (so we don't end up
 * wrapping around) as well as preventing the whole window from scrolling while we
 * try to zoom on the object.
 *
 * @param event
 */
function zoom(event) {
    // Stop the whole window from scrolling when we're on the canvas
    event.preventDefault();

    // Need to invert our direction so that it's more intuitive of a zoom
    cameraZoom -= event.deltaY * 0.05;

    // Set distance limits otherwise the object wraps around (and goes upside down)
    if (cameraZoom >= 150) {
        cameraZoom = 150; // This is arbitrary
    }  else if (cameraZoom <= 1) {
        cameraZoom = 1; // Just before the object "disappears"
    }
}