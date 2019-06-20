const core = require('biot-core');
const eventBus = require('ocore/event_bus');
const fs = require('fs');
const moment = require('moment');

let addresses = {};
try {
	fs.accessSync('./attested', fs.constants.R_OK | fs.constants.W_OK);
	addresses = fs.readFileSync('./attested');
	addresses = JSON.parse(addresses);
} catch (e) {
	addresses = {};
}

(async () => {
	await core.init('attestation-app-bsh');
	
	eventBus.on('paired', (from_address) => {
		core.sendTechMessageToDevice(from_address, {type: 'imapp'});
	});
	
	eventBus.on('object', async (from_address, object) => {
		if (object.app === 'BIoT') {
			if (object.type === 'hello') {
				if (addresses[from_address]) {
					core.sendTechMessageToDevice(from_address, {
						type: 'render', page: 'attested', form: [
							{type: 'h2', title: 'You attested'}
						]
					});
				} else {
					core.sendTechMessageToDevice(from_address, {
						type: 'render', page: 'index', form: [
							{type: 'input', title: 'Name', id: 'name', required: true},
							{type: 'input', title: 'Last Name', id: 'lname', required: true},
							{type: 'input', title: 'Date of birth (mm.dd.yyyy)', id: 'birth', required: true},
							{type: 'address', required: true, title: 'Select wallet for address', id: 'address'},
							{type: 'blank_line'},
							{type: 'submit', title: 'Send'}
						]
					});
				}
			} else if (object.type === 'response') {
				if (object.page === 'index') {
					let d = moment(object.response.birth, "MM.DD.YYYY");
					if (d.isValid()) {
						core.sendTechMessageToDevice(from_address, {
							type: 'alert', message: 'Incorrect date of birth'
						});
						return;
					}
					if(d.unix() < moment().subtract(100, 'years').unix() || d.unix() >= moment().unix()){
						core.sendTechMessageToDevice(from_address, {
							type: 'alert', message: 'Incorrect date of birth'
						});
						return;
					}
					
					let res = await core.postPrivateProfile(object.response.address, {
						name: object.response.name,
						lname: object.response.lname,
						birth: object.response.birth
					});
					core.sendTechMessageToDevice(from_address, {
						type: 'addProfile',
						my_address: res.address,
						your_address: object.response.address,
						unit: res.objJoint.unit.unit,
						profile: res.src_profile
					});
					addresses[from_address] = true;
					fs.writeFileSync('./attested', JSON.stringify(addresses));
					setTimeout(() => {
						core.sendTechMessageToDevice(from_address, {
							type: 'render', page: 'attested', form: [
								{type: 'h2', title: 'You attested'}
							]
						});
					}, 200);
				}
			}
		}
	});
	
})().catch(console.error);
