import { Scenes, session, Telegraf } from 'telegraf';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);

// variable declaration
let MyDateString = "";

// methods
const formatDate = (date) => {
	MyDateString = ('0' + date.getDate()).slice(-2) + '-' + ('0' + (date.getMonth()+1)).slice(-2) + '-' + date.getFullYear();
	return MyDateString;
};

const formatReplyMessage = (ctx, response) => {
	let respData = "";
	response.data.centers.forEach(center => {
		respData += `Name : ${center.name}
Address : ${center.address}
Pincode : ${center.pincode}
District : ${center.district_name}
Fee Type : ${center.fee_type}
`;
		center.sessions.forEach(session => {
			if(session.available_capacity > 0) {
				respData += `----------------------------------------------------
`;
				respData += `Available Date : ${session.date}
	Minimum Age Limit : ${session.min_age_limit}
	Available Capacity : ${session.available_capacity}
	Vaccine : ${session.vaccine}
	Slots : `;
				session.slots.forEach((slot, slotIndex, slots) => {
					if(slotIndex == slots.length - 1) {
						respData += `${slot}`;
					} else {
						respData += `${slot}, `;
					}
				});
				respData += `
----------------------------------------------------
`;
			}
		});
		if(center.fee_type == "Paid") {
			center.vaccine_fees.forEach(vaccine_fee => {
				respData += `Vaccine Fee : ${vaccine_fee.fee}`;
			});
		}
		if(respData.includes("Slots")) {
			ctx.reply(respData);
		} else {
			ctx.reply(respData + `----------------------------------------------------
No slots available at this hospital right now. Please check again later
----------------------------------------------------`);
		}
		respData = "";
	});
};

// define the scene <-- called using ctx.scene.enter('pincode_scene')
const pincodeScene = new Scenes.BaseScene('pincode_scene');
pincodeScene.enter(ctx => ctx.reply("Please enter the pincode"));
pincodeScene.on('text', ctx => {
	if(ctx.message.text.charAt(0) !== '/') { // if the user reply is not a command
		axios.get('/v2/appointment/sessions/public/calendarByPin', {
			params: {
				"pincode": `${ctx.message.text}`,
				"date": formatDate(new Date(Date.now()))
			},
			baseURL: 'https://cdn-api.co-vin.in/api',
			headers: { "User-Agent": 'Chrome/51.0.2704.106' }
		}).then((response) => {
			if(response.data.centers) {
				formatReplyMessage(ctx, response);
			} else {
				ctx.reply(`No available centers right now. Please check again later`);
			}
			ctx.scene.leave('pincode_scene');
		}).catch((err) => {
			console.log(err.response.data);
			ctx.reply(`Please enter a valid pincode`);
		});
	}
});

const stage = new Scenes.Stage([pincodeScene], { ttl: 10 }); // stage the scene
bot.use(session());
bot.use(stage.middleware()); // invoke stage as a middleware function

// bot call methods
bot.start(async (ctx) => {
  await ctx.reply(`Welcome ${ctx.from.first_name}`);
  await bot.telegram.sendMessage(ctx.chat.id, `Select the way to filter vaccination centers`, {
		reply_markup: {
			inline_keyboard: [
				[
					{
						'text': 'Pincode',
						'callback_data': 'pincode'
					}
				]
			]
		}
  });
});

bot.action('pincode', ctx => { // invokes when the callback_data is pincode
	ctx.answerCbQuery("Wait"); // alert the user during wait
	ctx.deleteMessage(); // delete the inline_keyboard
	ctx.scene.enter('pincode_scene'); // enter the scene to receive pincode for further process --> pincodeScene
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
