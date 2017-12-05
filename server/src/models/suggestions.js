var db = require('../db.js')
var ObjectID = require('mongodb').ObjectID
//const userUtil = require('../../../shared/user-util')
const { LIST_APPROVED,LIST_PENDING, LIST_USER, 
		STATUS_APPROVED, STATUS_PENDING, STATUS_DELETED 
} = require('../../../shared/suggestion-util')
const Chance = require('chance')
const _ = require('lodash')
const moment = require('moment')

module.exports = {
    //send vote count, don't send votes itself
    getSuggestions(channelId, user, listType, offset, limit, sortBy = 'votesLength'){
		var channels = db.get().collection('channels')
		let match;
		if(listType === LIST_APPROVED)
			match = { $match: { 'suggestions.status': STATUS_APPROVED } }
		else if(listType === LIST_PENDING)
			match = { $match: { 'suggestions.status': STATUS_PENDING } }
		else if(listType === LIST_USER){
			match = { $match: { 
							$or: [
								{ 'suggestions.user.id': user.id }, 
								{ 'suggestions.user.opaqueId': user.opaqueId }
							] 
						} 
					}
		}
		
        return channels.aggregate([
			{ $match: { channelId } },
			//easier to work with documents than array
			{ $unwind: '$suggestions' },
			//approved/pending/user
			match,
			//get rid of irrelavent channel data
			{ $replaceRoot: { newRoot: '$suggestions' } },
			//add computed fields
            { $addFields: { 
					votesLength: { $size: "$votes" } ,
					//check if user has upvoted post with either real id or opaque id
					hasUpvoted: { 
						$and: [
							{$in : [ user.id, "$votes.id" ]},
							{$in : [ user.opaqueId, "$votes.opaqueId" ]}
						]
					},
					broadcasterUpvoted: { $in : [ channelId, "$votes.id" ] }
				},
			},
			//client doesn't need vote data
			{ $project :    { votes: 0 } },
            { $sort:        { [sortBy]: -1 } },
            { $skip:        offset },
            { $limit:       limit },
        ])
        .toArray()

	},//sorted by most recent
	getSuggestionsByUser(channelId, user){
        var channels = db.get().collection('channels')
		return channels.aggregate([
			{ $match: { channelId } },
			{ $unwind: '$suggestions' },
			{ $match: { 
					$or: [
						{ 'suggestions.user.id': user.id }, 
						{ 'suggestions.user.opaqueId': user.opaqueId }
					] 
				} 
			},
			{ $replaceRoot: { newRoot: '$suggestions' } },
			{ $project :    { votes: 0 } },
            { $sort:        { createdAt: -1 } },
		])
        .toArray()
	},
    addSuggestion(channelId, suggestion){
		var channels = db.get().collection('channels')
		let maxLength = 100;
		suggestion.text = suggestion.text.substring(0,maxLength)

        return channels.updateOne(
            { channelId },
            { 
                $push: { 
                    suggestions: suggestion
                }
            }
        )
	},
    deleteSuggestion(channelId, suggestionId){
        var channels = db.get().collection('channels')
        return channels.updateOne(
			{ channelId, "suggestions.id": new ObjectID(suggestionId) },
			{ $set: { "suggestions.$.status": STATUS_DELETED } }
        )
	},
	upvote(channelId,suggestionId,user){
		var channels = db.get().collection('channels')
		user = _.pick(user,'id','opaqueId')
		return channels.updateOne(
			{ channelId, "suggestions.id": new ObjectID(suggestionId) },
			{
				$addToSet:
				{
					"suggestions.$.votes": user
				}
			})
	},//not technically a downvote, it just removes existing upvote
	//checks for real user vote && opaque user vote to be thorough.
	downvote(channelId,suggestionId,user){
		var channels = db.get().collection('channels')
		user = _.pick(user,'id','opaqueId')
		let opaqueUser = { id: null, opaqueId: user.opaqueId }
		return channels.updateOne(
			{ channelId, "suggestions.id": new ObjectID(suggestionId) },
			{
				$pullAll:
				{
					"suggestions.$.votes":[
						user, opaqueUser
					]
				}
			})
	},
	getSuggestionsCount(channelId){
		var channels = db.get().collection('channels')
		return channels.aggregate([
			{ $match:{ channelId } },
			{ $project: { count: { $size: '$sugestions' } } }
		])
	},
    //test only
    generate(){
        var chance = new Chance();
        var channels = db.get().collection('channels')
        let numSuggestions = chance.integer({min: 30, max: 50}) 
    
        let suggestions = []
        for(let i=0;i<numSuggestions;i++)
            suggestions.push(generateSuggestion())
        channels.updateOne({ channelId: '23435553' }, { $set: { suggestions } })
    }
}

function generateSuggestion(){
    var chance = new Chance();
    let numVotes = chance.integer({min: 1, max: 50}) 
    let votes = []
    for(let i=0;i<numVotes;i++){
        let userId = chance.integer({min: 1000, max: 9999}) 
        votes.push({ userId })
    }
	let userId = chance.integer({min: 1000000, max: 5000000})
    return {
        id: new ObjectID(),
        "text": chance.sentence({ length: 100 }),
        "postAnonymously": chance.bool(),
        createdAt: moment().subtract(chance.integer({min:0,max:500}),'days').toDate(),
        status: Math.random() > .5 ? STATUS_APPROVED: STATUS_PENDING,
        votes,
        "user": {
            "id":  userId,
            "opaqueId": 'U'+userId,
            "name": chance.name(),
            "profileImg": chance.avatar(),
            "role": "viewer"
        }
    }
    
}
