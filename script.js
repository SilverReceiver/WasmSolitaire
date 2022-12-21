document.addEventListener("DOMContentLoaded", Loaded, false);

var canvas;
var ctx;

var MouseX = 0;
var MouseY = 0;
var MouseEndedDown = 0;
var ShiftEndedDown = 0;

var heap;

function logKey(e)
{
    let Rect = canvas.getBoundingClientRect();
    MouseX = e.clientX - Rect.left;
    MouseY = e.clientY - Rect.top;
    //console.log(e);
    //console.log("My mouse ", MouseX, MouseY);
}

function clamp(low, high, value) {
    return Math.min(Math.max(low, value), high);
}

function hexcolor(r, g, b, a) {
    r = clamp(0, 255, Math.floor(r*255)).toString(16).padStart(2, 0);
    g = clamp(0, 255, Math.floor(g*255)).toString(16).padStart(2, 0);
    b = clamp(0, 255, Math.floor(b*255)).toString(16).padStart(2, 0);
    a = clamp(0, 255, Math.floor(a*255)).toString(16).padStart(2, 0);
    return '#'+r+g+b+a;
}

var BitmapIndex;

function CopyImageToOffset(Offset, Image)
{
    let canvas = document.getElementById("app");
    let ctx = canvas.getContext("2d");
    ctx.drawImage(Image, 0, 0);
    const imageData = ctx.getImageData(0, 0, Image.width, Image.height, "srgb");
    const count = Image.width * Image.height * 4;

    for (var i = 0; i < count; i++) {
	heap[Offset + i] = imageData.data[i];
    }
    console.log("BitmapIndex:");
    console.log(BitmapIndex);
    BitmapIndex += (Image.width * Image.height * 4);
}

function GetString(Memory, Offset, Length) 
{
    //console.log("pointer", Offset);
    const view = new Uint8Array(Memory.buffer, Offset, Length);
    //console.log(view);
    let string = '';
    for (let i = 0; i < Length; i++) {
	string += String.fromCharCode(view[i]);
    }
    return(string);
}

function LoadImage(Filename) {
    return new Promise((resolve, reject) => {
	let image = new Image();
	image.crossOrigin = 'anonymous';
	image.src = Filename;			
	image.loading = "eager";
	
	image.onload = () => {resolve(image);
			      console.log(image);
	CopyImageToOffset(BitmapIndex, image);
			     }
	const msg = `Could not load image at ${Filename};`
	image.onerror = () => reject(new Error(msg));
    })
}

function Loaded()
{
    let wasm; 
    let MemorySizeInBytes;
    let FrameBufferBytes;

    canvas = document.getElementById("app");    
    ctx = canvas.getContext("2d");

    var TempCanvas = document.getElementById("temp");
    var TempCtx = TempCanvas.getContext("2d"); 

    FrameBufferBytes = canvas.width * canvas.height * 4;
    console.log(FrameBufferBytes);

    let memory = new WebAssembly.Memory({ initial: 800, maximum: 800 });
    heap = new Uint8Array(memory.buffer);
    console.log(heap);
    heap32 = new Uint32Array(memory.buffer);
    console.log(heap32);

    MemorySizeInBytes = heap.length;
    console.log(MemorySizeInBytes);

    BitmapIndex = (MemorySizeInBytes / 2) + FrameBufferBytes;

    const ImgArr = [];
    ImgArr.push(
	LoadImage("Cards\\Clubs.bmp"),               
	LoadImage("Cards\\Hearts.bmp"),    
	LoadImage("Cards\\Diamond.bmp"),            
	LoadImage("Cards\\Spades.bmp"),     
	LoadImage("Cards\\Back.bmp"),
	LoadImage("Cards\\Foun.bmp"),
    );

    var imports = {
	env: {
	    "memory": memory,
	    console_log: function(arg) { console.log(arg); },
	    console_log_real: function(arg) { console.log(arg); },
	    sqrtf: function(arg) {return(Math.sqrt(arg))},
	    roundf: function(arg) {return(Math.round(arg))},
	    ceilf: function(arg) {return(Math.ceil(arg))},
	    JS_PrintString: function(FilenamePtr, FilenameLength) {
		console.log(GetString(memory, FilenamePtr, FilenameLength));
	    },
	    RandomChoice: function(series, Range) {
		min = Math.ceil(0);
		max = Math.floor(Range);
		return Math.floor(Math.random() * (max - min + 1) + min); },
	}
    };

    var request = new XMLHttpRequest();
    request.open("GET", "sol.wasm");
    request.responseType = "arraybuffer";
    request.send();

    request.onload = function() {

	var wasmSource = request.response;
	var wasmModule = new WebAssembly.Module(wasmSource);
	var wasmInstance = new WebAssembly.Instance(wasmModule, imports);
	wasm = wasmInstance.exports;
	console.log(wasm);
	let StoreSize = MemorySizeInBytes / 2;
	//wasm.InitGameMemory(StoreSize, StoreSize);

	console.log("width and height", canvas.width, canvas.height)
	//wasm.InitFrameBuffer(canvas.width, canvas.height);
	/*	
		count = canvas.width * canvas.height * 4;
		for (var i = 0; i < count; i++) {
		imageData.data[i] = heap[i];
		}	
		ctx.putImageData(imageData, 0, 0);
	*/	
	console.log("passed");


	console.log(ImgArr);

	var First = 0;

	Promise.all(ImgArr).then((Images) => {
	    let prev = null;
	    function first(timestamp) {
		prev = timestamp;
		window.requestAnimationFrame(frame);
	    }
	    function frame(timestamp) {
		const dt = (timestamp - prev)*0.001;
		prev = timestamp;

		wasm.GameUpdateAndRender(StoreSize, StoreSize, canvas.width, canvas.height,
					 dt, MouseX, MouseY, MouseEndedDown, ShiftEndedDown, First);
		
		Image = new ImageData(new Uint8ClampedArray(memory.buffer, StoreSize, FrameBufferBytes), canvas.width);
//		console.log(Image);
		ctx.putImageData(Image, 0, 0);		
		First = 1;
		window.requestAnimationFrame(frame);
	    }
	    window.requestAnimationFrame(first);

	    document.addEventListener('mousemove', logKey);
	    document.addEventListener('mouseup', (e) => {
		switch (e.button) {
		case 0:
		    console.log('Left button up.');
		    MouseEndedDown = 0;
		    break;
		case 1:
		    console.log('Middle button up.');
		    break;
		case 2:
		    console.log('Right button up.');
		    break;
		default:
		    console.log("Unknown button code:", e.button);
		}
	    });
	    document.addEventListener('mousedown', (e) => {
		switch (e.button) {
		case 0:
		    console.log('Left button clicked.');
		    MouseEndedDown = 1;
		    break;
		case 1:
		    console.log('Middle button clicked.');
		    break;
		case 2:
		    console.log('Right button clicked.');
		    break;
		default:
		    console.log("Unknown button code:", e.button);
		}
	    });	

	    document.addEventListener('keydown', (e) => {
		console.log(e);
		switch(e.key){
		case("Shift"):		
		    {
			ShiftEndedDown = 1;
		    } break; 
		default:
		    {
		    }break;
		}
	    });
	    document.addEventListener('keyup', (e) => {
		console.log(e);
		switch(e.key){
		case("Shift"):		
		    {
			ShiftEndedDown = 0;
		    } break;
		default:
		    {
		    }break;
		}
	    });
    
	});
    }; // XMLHttpRequest.onload()
}


