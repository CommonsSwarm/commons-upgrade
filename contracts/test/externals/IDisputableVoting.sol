pragma solidity 0.4.24;

import "@aragon/minime/contracts/MiniMeToken.sol";

contract IDisputableVoting {
    event StartVote(
        uint256 indexed voteId,
        address indexed creator,
        bytes context,
        bytes executionScript
    );
    event PauseVote(uint256 indexed voteId, uint256 indexed challengeId);
    event ResumeVote(uint256 indexed voteId);
    event CancelVote(uint256 indexed voteId);
    event ExecuteVote(uint256 indexed voteId);
    event QuietEndingExtendVote(uint256 indexed voteId, bool passing);

    MiniMeToken public token;

    function getVote(uint256 _voteId)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint64,
            uint64,
            uint8,
            uint256,
            uint256,
            uint64,
            uint64,
            uint64,
            uint8,
            bytes32
        );

    function vote(uint256 _voteId, bool _supports) external;

    function executeVote(uint256 _voteId, bytes _executionScript) external;

    function canExecute(uint256 _voteId) external view returns (bool);

    function canVote(uint256 _voteId, address _voter)
        external
        view
        returns (bool);
}
