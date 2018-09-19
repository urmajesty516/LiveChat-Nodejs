var express=require('express');
var path = require('path');
var app=express();
var http=require('http').Server(app);
var io=require("socket.io")(http);
var users={};
var fs=require('fs');
var person_room={};
var roomNO=0;
var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'qianzhong516@gmail.com',
    pass: 'zq960516'
  }
});

var mailOptions = {
  from: 'qianzhong516@gmail.com',
  to: 'zhongqian516@gmail.com',
  subject: 'Sending Email using Node.js',
  text: 'That was easy!'
};

const port = process.env.PORT || 3000;


//The app.get() method specifies a callback function that will be invoked 
//whenever there is an HTTP GET request with a path ('/') relative to the site root.
app.get('/',function(req,res){
	res.sendFile(__dirname+"/index.html");
});

//This specifies the root directory from which to serve static assets 
app.use(express.static(path.join(__dirname, '/public')));

io.on('connection',function(socket){
	var nickname="";
	var name="";
	socket.on('getRoomInfo',function(){
		socket.emit('receiveRoomInfo', {'person_room': person_room, 'roomNO': roomNO});					
	});
	
	socket.on('joinRoom',function(data){
		nickname=data['person'];
		socket.join(data['room']);					
		users[nickname]=socket;
		var theOther=findKey(person_room,data['room']);
		
		name=getName(nickname);	
			
		/*if there is another person in this room*/
		if(theOther){
			var theOtherName=getName(theOther);
			io.to(data['room']).emit('chat', '<i class="fas fa-volume-up"></i> <span style="color: #a6a6a6; font-size: 12px;">'+name+' and '+theOtherName+' joined together now. Let\'s chat!</span>');
			/*update users_online*/	
			socket.emit('users_online',theOther);
			users[theOther].emit('users_online',nickname);
		}else{
			socket.emit('chat', '<i class="fas fa-volume-up"></i> <span style="color: #a6a6a6; font-size: 12px;">'+name+' has joined the chatroom. Waiting for connection...</span>');
			transporter.sendMail(mailOptions, function(error, info){
			  if (error) {
				console.log(error);
			  } else {
				console.log('Email sent: ' + info.response);
			  }
			});						
		}			
				
	});
	
	socket.on('updateRoomInfo',function(list){
		person_room =  JSON.parse(JSON.stringify(list));
		console.log(person_room);
	});

	socket.on('updateRoomNO',function(NO){
		roomNO=NO;
	});
	
	socket.on('disconnect',function(){
		var nickname=findKey(users,socket);
		delete users[nickname];
		if(nickname){
			//broadcast: {user} left the room
			io.to(person_room[nickname]).emit('chat','<i class="fas fa-volume-up"></i> <span style="color: #a6a6a6; font-size: 12px;">User '+name+' has left the room.</span>');
			//update user online list, remove the left user
			io.to(person_room[nickname]).emit('users_online_delete',nickname);
		}	
		delete person_room[nickname];
	});		
	
	/*Person1 appended the msg locally*/
	/*Only pass through the msg to the other person by socket*/
	socket.on('chat',function(data){	
		var room=person_room[data['nickname']];
		var theOther=findtheOtherKey(person_room, room, data['nickname']);
		var theOtherSocket=users[theOther];
		if(theOtherSocket){
			theOtherSocket.emit('chat', "<button style='background: #292929; color: #fff; border: none; outline: none; border-radius: 8px; width: 60px; text-align: center; padding: 3px 5px; font-size: 12px'>"+name+"</button> "+data['msg']);			
		}else{
			socket.emit('chat','<i class="fas fa-volume-up"></i> <span style="color: #a6a6a6; font-size: 12px;">Dear customer, our staff will get back to you shortly, please wait for a connection :)</span>');
		}

	});
	
	//{user} typing event
	socket.on('user_typing',function(msg){
		var nickname=findKey(users,socket);
		//if user is typing
		if(msg){
			//avoid user {false} typing message
			if(nickname){
				io.to(person_room[nickname]).emit('user_typing', "["+nickname+"]<span style='color: #a6a6a6; font-size: 12px;'>"+name+" is typing...</span>");				
			}	
		//if user is off typing	
		}else{
			io.to(person_room[nickname]).emit('user_typing_off', nickname);				
		}
	});
	//uploading
	socket.on('startUpload',function(){
		//this nickname
		var nickname=findKey(users,socket);
		var theOther=findtheOtherKey(person_room, person_room[nickname], nickname);	
		
		if(theOther){
			users[theOther].emit('startUpload','<button style="background: #292929; color: #fff; border: none; outline: none; border-radius: 8px; width: 60px; text-align: center; padding: 3px 5px; font-size: 12px; margin-bottom: 5px;">'+name+'</button><br><div id="lds-spinner-'+nickname+'" class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>');			
		}else{
			socket.emit('chat','<i class="fas fa-volume-up"></i> <span style="color: #a6a6a6; font-size: 12px;">Dear customer, our staff will get back to you shortly, please wait for a connection :)</span>');
		}
	
	});
	var fileData=[];
	var slice=0;
	var dir=__dirname+'/public/files/';
	socket.on('uploading',function(file){	
		fileData.push(file['data']);
		slice++;
		/*If all the data is collected*/
		if(slice*100000>=file['size']){
			/*Join the chrunks of arrayBuffers*/
			var fileBuffer = Buffer.concat(fileData); 
			/*Convert arrayBuffer to Buffer*/
			var buffer=toBuffer(fileBuffer);
			var path=dir+file['name'];
			/*Open the directory, write the file to /public/files */
			fs.open(path,'w',function(err,fd){
				if(err){
					 throw 'could not open file: ' + err;
				}
				/* Write the file */
				fs.write(fd, buffer, 0, buffer.length, null, function(err){
					if (err) throw 'error writing file: ' + err;
					fs.close(fd, function() {
						console.log('wrote the file successfully');
					});
				});				
			});
			//this nickname
			var nickname=findKey(users,socket);
			var theOther=findtheOtherKey(person_room, person_room[nickname], nickname);				
			users[theOther].emit('uploadDone', {'user': file['user'], 'fileName': file['name']});		
			fileData=[];	
			slice=0;
		}else{
			//request more data of the file is being uploaded
			socket.emit('requestSlice', slice);			
		}
	});
});

http.listen(port,function(){
	console.log('Listening on port 3000');
});

//find the key in a object array matched with value
function findKey(array,value){
	for(var key in array){
		if(array[key]==value){
			return key;
		}
	}
	return false;
}

/*Find the other key in the array hasing the same value*/
function findtheOtherKey(list,room,person){
	for(var i in list){
		if(list[i]==room && person!=i){
			return i;
		}
	}
	return false;
}

/*Convert arrayBuffer to Buffer*/
function toBuffer(ab) {
    var buffer = new Buffer(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }
    return buffer;
}

/*Replace Token Client_ or Staff_ in nickname*/
function getName(nickname){
	var name;
	var arr=['Client_','Staff_'];
	for(var i in arr){
		if(nickname.indexOf(arr[i])>-1){
			name=nickname.replace(arr[i],'');
			return name;
		}
	}
	return false;
}