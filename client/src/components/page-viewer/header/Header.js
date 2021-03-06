import React, { Component } from 'react';
import { connect } from 'react-redux'
import Title from './Title'
import Toolbar from './Toolbar'
import './Header.scss'

class Header extends Component {
	constructor(props){
		super(props)
		this.state = {
			showNotification: true
		}
	}
    render() {
		let { showNotification } = this.state
		let { currentUser } = this.props
        return (
            <div className="viewer-header">
                <Title/>
				<Toolbar/>
				{currentUser.isAnonymousUser && showNotification ? this.anonymousUserNotification() : null}
            </div>
        );
	}
	anonymousUserNotification(){
		/*eslint react/jsx-no-bind:0 */
		return (
			<article className="message is-warning is-small">
				<div className="message-header">
				<p>Anonymous User</p>
				<button onClick={()=>this.setState({ showNotification: false })} className="delete is-small"></button>
				</div>
				<div className="message-body">
					Logged out users cannot upvote or post.
				</div>
			</article>
		)
	}
}

const mapStateToProps = (state) => {
	let { user } = state
	return {
		currentUser: user,
    }
}
export default connect(mapStateToProps)(Header)
