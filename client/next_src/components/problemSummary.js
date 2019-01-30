// Preview a problem on variant page
Vue.component('my-problem-summary', {
	props: ['prob','userid','preview'],
	template: `
		<div class="row problem">
			<div class="col-sm-12 col-md-6 diagram"
				v-html="getDiagram(prob.fen)">
			</div>
			<div class="col-sm-12 col-md-6">
				<p v-html="prob.instructions"></p>
				<p v-if="!!prob.preview" v-html="prob.solution"></p>
				<p v-else class="problem-time">{{ timestamp2date(prob.added) }}</p>
				<button v-show="!preview" @click="$emit('show-problem')">Show</button>
				<div v-show="prob.uid==userid && !preview" class="button-group">
					<button @click="$emit('edit-problem')">Edit</button>
					<button @click="$emit('delete-problem')">Delete</button>
				</div>
			</div>
		</div>
	`,
	methods: {
		getDiagram: function(fen) {
			const fenParsed = V.ParseFen(fen);
			return getDiagram({
				position: fenParsed.position,
				turn: fenParsed.turn,
				// No need for flags here
			});
		},
		timestamp2date(ts) {
			return getDate(new Date(ts));
		},
	},
})